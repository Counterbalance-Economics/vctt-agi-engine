
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLLMMetadata1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add LLM metadata columns to messages table
    await queryRunner.addColumn('messages', new TableColumn({
      name: 'model',
      type: 'varchar',
      isNullable: true,
    }));

    await queryRunner.addColumn('messages', new TableColumn({
      name: 'tokens_input',
      type: 'int',
      isNullable: true,
    }));

    await queryRunner.addColumn('messages', new TableColumn({
      name: 'tokens_output',
      type: 'int',
      isNullable: true,
    }));

    await queryRunner.addColumn('messages', new TableColumn({
      name: 'tokens_total',
      type: 'int',
      isNullable: true,
    }));

    await queryRunner.addColumn('messages', new TableColumn({
      name: 'cost_usd',
      type: 'decimal',
      precision: 10,
      scale: 6,
      isNullable: true,
    }));

    await queryRunner.addColumn('messages', new TableColumn({
      name: 'latency_ms',
      type: 'int',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('messages', 'latency_ms');
    await queryRunner.dropColumn('messages', 'cost_usd');
    await queryRunner.dropColumn('messages', 'tokens_total');
    await queryRunner.dropColumn('messages', 'tokens_output');
    await queryRunner.dropColumn('messages', 'tokens_input');
    await queryRunner.dropColumn('messages', 'model');
  }
}
