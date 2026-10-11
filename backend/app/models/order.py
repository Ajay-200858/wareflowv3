from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, func
from app.database.connection import Base
from sqlalchemy.orm import relationship

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    address = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    status = Column(String(50), default="PENDING") # PENDING, RESERVED, PICKING, PACKING, DELIVERY, COMPLETED
    priority = Column(String(50), default="NORMAL")
    delivery_address = Column(String(500))
    required_date = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    company = relationship("Company")
    customer = relationship("Customer")
    items = relationship("OrderItem", back_populates="order")
    jobs = relationship("Job", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    quantity = Column(Integer, nullable=False)
    picked_quantity = Column(Integer, default=0)

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
