
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artifact } from '../entities/artifact.entity';
import { CreateArtifactDto } from '../dto/artifact.dto';

@Injectable()
export class ArtifactsService {
  private readonly logger = new Logger(ArtifactsService.name);

  constructor(
    @InjectRepository(Artifact)
    private artifactRepository: Repository<Artifact>,
  ) {}

  /**
   * Create a new artifact
   */
  async createArtifact(dto: CreateArtifactDto): Promise<Artifact> {
    this.logger.log(`Creating artifact for goal ${dto.goalId}: ${dto.artifactName}`);

    const artifact = this.artifactRepository.create({
      goalId: dto.goalId,
      artifactType: dto.artifactType,
      artifactName: dto.artifactName,
      artifactDescription: dto.artifactDescription,
      artifactPath: dto.artifactPath,
      artifactData: dto.artifactData,
      fileSize: dto.fileSize,
      mimeType: dto.mimeType,
      metadata: dto.metadata,
      createdBy: dto.createdBy || 'min',
    });

    return await this.artifactRepository.save(artifact);
  }

  /**
   * Get all artifacts for a goal
   */
  async getArtifactsByGoal(goalId: number): Promise<Artifact[]> {
    return await this.artifactRepository.find({
      where: { goalId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single artifact by ID
   */
  async getArtifactById(id: number): Promise<Artifact> {
    const artifact = await this.artifactRepository.findOne({ where: { id } });
    if (!artifact) {
      throw new NotFoundException(`Artifact with ID ${id} not found`);
    }
    return artifact;
  }

  /**
   * Get all artifacts of a specific type
   */
  async getArtifactsByType(artifactType: string): Promise<Artifact[]> {
    return await this.artifactRepository.find({
      where: { artifactType },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all artifacts with pagination
   */
  async getAllArtifacts(page: number = 1, limit: number = 20): Promise<{ artifacts: Artifact[]; total: number; page: number; totalPages: number }> {
    const [artifacts, total] = await this.artifactRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      artifacts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Delete an artifact
   */
  async deleteArtifact(id: number): Promise<void> {
    const result = await this.artifactRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Artifact with ID ${id} not found`);
    }
    this.logger.log(`Deleted artifact ${id}`);
  }

  /**
   * Get artifact statistics
   */
  async getArtifactStats(): Promise<any> {
    const db = this.artifactRepository.manager;

    const stats = await db.query(`
      SELECT 
        artifact_type,
        COUNT(*) as count,
        SUM(COALESCE(file_size, 0)) as total_size
      FROM goal_artifacts
      GROUP BY artifact_type
      ORDER BY count DESC
    `);

    const totalArtifacts = await this.artifactRepository.count();

    return {
      total: totalArtifacts,
      byType: stats,
    };
  }
}
