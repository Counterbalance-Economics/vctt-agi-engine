
"""Initial schema

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create sessions table
    op.create_table(
        'sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', name='sessionstatus'), nullable=False),
        sa.Column('context', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sessions_user_id'), 'sessions', ['user_id'], unique=False)

    # Create analysis_results table
    op.create_table(
        'analysis_results',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_type', sa.Enum('ANALYST', 'RELATIONAL', 'SYNTHESISER', name='agenttype'), nullable=False),
        sa.Column('content', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_analysis_results_session_id'), 'analysis_results', ['session_id'], unique=False)

    # Create module_metrics table
    op.create_table(
        'module_metrics',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('module_name', sa.String(length=50), nullable=False),
        sa.Column('metrics_json', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_module_metrics_session_id'), 'module_metrics', ['session_id'], unique=False)

    # Create agent_logs table
    op.create_table(
        'agent_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('agent_type', sa.Enum('ANALYST', 'RELATIONAL', 'SYNTHESISER', name='agenttype'), nullable=False),
        sa.Column('action', sa.String(length=255), nullable=False),
        sa.Column('details', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_agent_logs_session_id'), 'agent_logs', ['session_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_agent_logs_session_id'), table_name='agent_logs')
    op.drop_table('agent_logs')
    op.drop_index(op.f('ix_module_metrics_session_id'), table_name='module_metrics')
    op.drop_table('module_metrics')
    op.drop_index(op.f('ix_analysis_results_session_id'), table_name='analysis_results')
    op.drop_table('analysis_results')
    op.drop_index(op.f('ix_sessions_user_id'), table_name='sessions')
    op.drop_table('sessions')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS agenttype')
    op.execute('DROP TYPE IF EXISTS sessionstatus')
