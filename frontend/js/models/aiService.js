(function() {
  'use strict';
  
  // Real ML Integration via apiClient
  window.aiService = {
    async forecastDemand(productId) {
      if (!window.apiClient) return null;
      try {
        const response = await window.apiClient.ai.getDemand(productId);
        // Map backend format to what UI expects
        return {
          p7: response.p7,
          p30: response.p30,
          trend: response.trend,
          confidence: response.confidence,
          version: response.version
        };
      } catch (err) {
        console.error("Failed to fetch demand forecast:", err);
        return null;
      }
    },

    async recommendStorage(productId) {
      if (!window.apiClient) return null;
      try {
        const response = await window.apiClient.ai.recommendStorage({ product_id: productId, quantity: 1 });
        return {
          location: response.location,
          locationId: response.location_id,
          confidence: response.confidence,
          reason: response.reason,
          recommendationId: response.id
        };
      } catch (err) {
        console.error("Failed to recommend storage:", err);
        return null;
      }
    },

    async assignEmployee(job) {
      if (!window.apiClient) return null;
      try {
        // job object might have id
        const jobId = job.id || job.job_id;
        if (!jobId) return null;
        
        const response = await window.apiClient.ai.recommendEmployee(jobId);
        return {
          employeeId: response.employeeId,
          name: response.name,
          confidence: response.confidence,
          reason: response.reason,
          recommendationId: response.id
        };
      } catch (err) {
        console.error("Failed to recommend employee:", err);
        return null;
      }
    },

    // Workload optimization is a complex batch operation, mock for now if not implemented in API
    async optimizeWorkload() {
        return null; // Not explicitly requested in Phase 5 prompt to implement batch workload optimization
    },
    
    async submitFeedback(recommendationId, decision, reason = "") {
        if (!window.apiClient) return false;
        try {
            await window.apiClient.ai.submitFeedback({
                recommendation_id: recommendationId,
                decision: decision,
                reason: reason
            });
            return true;
        } catch(err) {
            console.error("Failed to submit feedback:", err);
            return false;
        }
    }
  };
})();
