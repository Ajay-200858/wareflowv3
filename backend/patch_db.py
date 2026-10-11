import os
from sqlalchemy import text
from app.database.connection import SessionLocal

def patch_db():
    db = SessionLocal()
    try:
        # Add new columns to ai_recommendations
        queries = [
            "ALTER TABLE ai_recommendations ADD COLUMN product_id INT;",
            "ALTER TABLE ai_recommendations ADD COLUMN recommended_position_id INT;",
            "ALTER TABLE ai_recommendations ADD COLUMN actual_position_id INT;",
            "ALTER TABLE ai_recommendations ADD COLUMN alternative_positions TEXT;",
            "ALTER TABLE ai_recommendations ADD COLUMN features_used TEXT;",
            "ALTER TABLE ai_recommendations ADD COLUMN quantity INT;"
        ]
        
        for q in queries:
            try:
                db.execute(text(q))
                db.commit()
                print(f"Executed: {q}")
            except Exception as e:
                db.rollback()
                print(f"Failed (might already exist): {q} - {str(e)}")
                
    finally:
        db.close()

if __name__ == "__main__":
    patch_db()
