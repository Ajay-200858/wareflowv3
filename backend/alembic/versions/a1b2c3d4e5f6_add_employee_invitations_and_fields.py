"""add employee invitations table and employee fields

Revision ID: a1b2c3d4e5f6
Revises: 7fc7cdd76cd1
Create Date: 2026-10-11 19:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '7fc7cdd76cd1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create employee_invitations table
    op.create_table(
        'employee_invitations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('invitation_code', sa.String(length=64), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('role_type', sa.String(length=50), nullable=True, server_default='Picker'),
        sa.Column('warehouse_id', sa.Integer(), nullable=True),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('used_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['used_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_employee_invitations_id'), 'employee_invitations', ['id'], unique=False)
    op.create_index(op.f('ix_employee_invitations_invitation_code'), 'employee_invitations', ['invitation_code'], unique=True)

    # 2. Add columns to employees table
    op.add_column('employees', sa.Column('warehouse_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_employees_warehouse_id', 'employees', 'warehouses', ['warehouse_id'], ['id'])
    op.add_column('employees', sa.Column('employee_code', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_employees_employee_code'), 'employees', ['employee_code'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_employees_employee_code'), table_name='employees')
    op.drop_constraint('fk_employees_warehouse_id', 'employees', type_='foreignkey')
    op.drop_column('employees', 'employee_code')
    op.drop_column('employees', 'warehouse_id')

    op.drop_index(op.f('ix_employee_invitations_invitation_code'), table_name='employee_invitations')
    op.drop_index(op.f('ix_employee_invitations_id'), table_name='employee_invitations')
    op.drop_table('employee_invitations')
