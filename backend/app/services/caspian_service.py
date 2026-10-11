import logging
import urllib.request
import urllib.error
import json
import time
from typing import Dict, Any, Optional, List
from app.core.config import settings

logger = logging.getLogger("wareflow.caspian")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] [CASPIAN] %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

class CaspianService:
    """
    Caspian Notification Service Integration.
    Gateway: https://api.trycaspianai.com
    Channels: email, telegram, discord, slack, sms
    """

    def __init__(self):
        self.base_url = settings.CASPIAN_BASE_URL.rstrip("/")
        self.api_key = settings.CASPIAN_API_KEY
        self.channel = settings.CASPIAN_CHANNEL
        self.timeout = settings.CASPIAN_TIMEOUT_SECONDS
        self.max_retries = settings.CASPIAN_RETRY_ATTEMPTS

    def is_configured(self) -> bool:
        """Returns True if a non-empty API key is configured."""
        return bool(self.api_key and self.api_key.strip())

    def check_connection(self) -> Dict[str, Any]:
        """
        Tests active connectivity to the Caspian gateway.
        Public endpoint GET /v1/channels does not require bearer token,
        allowing true network and gateway health verification.
        """
        url = f"{self.base_url}/v1/channels"
        headers = {
            "User-Agent": "WareFlow-Caspian-Integration/1.0",
            "Accept": "application/json"
        }

        try:
            req = urllib.request.Request(url, headers=headers, method="GET")
            start = time.time()
            with urllib.request.urlopen(req, timeout=self.timeout) as response:
                elapsed_ms = round((time.time() - start) * 1000, 2)
                if response.status == 200:
                    data = json.loads(response.read().decode("utf-8"))
                    channels = [ch.get("channel") for ch in data if isinstance(ch, dict)]
                    return {
                        "connected": True,
                        "status_code": 200,
                        "latency_ms": elapsed_ms,
                        "available_channels": channels,
                        "error": None
                    }
                else:
                    return {
                        "connected": False,
                        "status_code": response.status,
                        "latency_ms": elapsed_ms,
                        "available_channels": [],
                        "error": f"Unexpected status code {response.status}"
                    }
        except urllib.error.HTTPError as e:
            return {
                "connected": False,
                "status_code": e.code,
                "available_channels": [],
                "error": f"HTTP {e.code}: {e.reason}"
            }
        except urllib.error.URLError as e:
            logger.error(f"Network connection to Caspian gateway failed: {e.reason}")
            return {
                "connected": False,
                "status_code": None,
                "available_channels": [],
                "error": f"Gateway unreachable: {str(e.reason)}"
            }
        except Exception as e:
            logger.error(f"Unexpected connection error to Caspian: {str(e)}")
            return {
                "connected": False,
                "status_code": None,
                "available_channels": [],
                "error": str(e)
            }

    def get_status(self) -> Dict[str, Any]:
        """
        Comprehensive diagnostic inspection of the Caspian notification integration.
        Distinguishes: Configured, Initialized, Connected.
        """
        configured = self.is_configured()
        conn_check = self.check_connection()

        if not configured:
            overall = "NOT WORKING"
            root_cause = "Missing CASPIAN_API_KEY credentials. No API key configured in .env or Settings."
        elif not conn_check["connected"]:
            overall = "NOT WORKING"
            root_cause = f"Caspian gateway unreachable: {conn_check.get('error')}"
        else:
            overall = "READY"
            root_cause = None

        return {
            "overall_status": overall,
            "stages": {
                "configured": configured,
                "initialized": True,
                "connected": conn_check["connected"],
                "api_key_set": configured
            },
            "gateway": {
                "base_url": self.base_url,
                "latency_ms": conn_check.get("latency_ms"),
                "supported_channels": conn_check.get("available_channels", [])
            },
            "root_cause": root_cause,
            "error": conn_check.get("error")
        }

    def dispatch(
        self,
        title: str,
        message: str,
        channel: Optional[str] = None,
        recipient: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Dispatches an outbound notification to Caspian.
        Performs authenticated delivery with timeout and retry tracking.
        Does NOT expose credentials in logs or output.
        """
        target_channel = channel or self.channel or "email"
        configured = self.is_configured()
        conn = self.check_connection()

        report: Dict[str, Any] = {
            "stage_configured": configured,
            "stage_initialized": True,
            "stage_connected": conn["connected"],
            "stage_accepted": False,
            "stage_delivered": False,
            "status": "FAILED",
            "channel": target_channel,
            "delivery_id": None,
            "retries_attempted": 0,
            "error": None
        }

        if not configured:
            err = "Caspian API key is not configured (CASPIAN_API_KEY missing). External dispatch aborted."
            logger.warning(f"Dispatch skipped: {err}")
            report["error"] = err
            report["status"] = "UNCONFIGURED"
            return report

        if not conn["connected"]:
            err = f"Caspian gateway unreachable at {self.base_url}: {conn.get('error')}"
            logger.error(f"Dispatch failed: {err}")
            report["error"] = err
            report["status"] = "GATEWAY_UNREACHABLE"
            return report

        # Multi-channel routing: Discover active conversations if available
        headers = {
            "User-Agent": "WareFlow-Caspian-Integration/1.0",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key.strip()}"
        }

        # Resolve active conversation for Discord/Telegram if applicable
        active_conv_id = None
        resolved_channel = target_channel

        try:
            req_conv = urllib.request.Request(f"{self.base_url}/v1/conversations", headers=headers, method="GET")
            with urllib.request.urlopen(req_conv, timeout=self.timeout) as resp_conv:
                convs = json.loads(resp_conv.read().decode("utf-8"))
            req_conn = urllib.request.Request(f"{self.base_url}/v1/connections", headers=headers, method="GET")
            with urllib.request.urlopen(req_conn, timeout=self.timeout) as resp_conn:
                conns = json.loads(resp_conn.read().decode("utf-8"))
            
            conn_map = {c["id"]: c for c in conns}
            # Search for matching conversation for the target channel
            exact_match = None
            fallback_match = None
            for conv in convs:
                ch = conn_map.get(conv.get("connection_id"), {}).get("channel")
                if ch == target_channel:
                    exact_match = (conv.get("id"), ch)
                    break
                elif target_channel in ("auto", "all", "email") and ch in ("discord", "telegram"):
                    if not fallback_match:
                        fallback_match = (conv.get("id"), ch)

            chosen = exact_match or fallback_match
            if chosen:
                active_conv_id, resolved_channel = chosen
        except Exception as e:
            logger.debug(f"Could not query active Caspian conversations: {e}")

        # Choose endpoint and payload
        if active_conv_id:
            url = f"{self.base_url}/v1/conversations/{active_conv_id}/messages"
            payload = {"text": f"[{title}]\n{message}"}
            report["channel"] = resolved_channel
        elif target_channel == "email":
            url = f"{self.base_url}/v1/test-emails"
            payload = {"text": f"[{title}] {message}"}
        else:
            url = f"{self.base_url}/v1/messages"
            payload = {
                "channel": target_channel,
                "recipient": recipient or "alerts@wareflow.internal",
                "title": title,
                "text": f"[{title}]\n{message}"
            }
        data_bytes = json.dumps(payload).encode("utf-8")

        # Safe delivery loop with exponential backoff
        for attempt in range(1, self.max_retries + 1):
            report["retries_attempted"] = attempt
            try:
                req = urllib.request.Request(url, headers=headers, data=data_bytes, method="POST")
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    if resp.status in (200, 201, 202):
                        resp_data = json.loads(resp.read().decode("utf-8"))
                        report["stage_accepted"] = True
                        report["stage_delivered"] = True
                        report["status"] = "DELIVERED"
                        report["delivery_id"] = resp_data.get("id") or resp_data.get("message_id")
                        logger.info(f"Notification delivered via Caspian [{report['channel']}]: delivery_id={report['delivery_id']}")
                        return report
                    else:
                        report["error"] = f"Caspian rejected notification with HTTP {resp.status}"
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="replace")
                logger.error(f"Caspian API HTTP error on attempt {attempt}: {e.code} {e.reason} - {err_body}")
                report["error"] = f"HTTP {e.code}: {e.reason} - {err_body}"
                # Non-retryable authentication / validation failures
                if e.code in (400, 401, 402, 403, 404, 422):
                    break
            except (urllib.error.URLError, TimeoutError) as e:
                logger.error(f"Caspian API timeout/network failure on attempt {attempt}: {str(e)}")
                report["error"] = f"Network timeout/error: {str(e)}"
            except Exception as e:
                logger.error(f"Unexpected error during Caspian delivery: {str(e)}")
                report["error"] = str(e)
                break

            if attempt < self.max_retries:
                time.sleep(0.5 * attempt)

        return report

caspian_service = CaspianService()
