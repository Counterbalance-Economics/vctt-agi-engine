
/**
 * DTOs for IDE-related operations (Phase 3.5)
 */

export class FileOperationDto {
  operation: 'create' | 'delete' | 'rename' | 'move' | 'read' | 'write';
  path: string;
  newPath?: string;
  content?: string;
  isDirectory?: boolean;
}

export class CodeEditDto {
  filePath: string;
  originalCode: string; // The code to edit (previously 'content')
  instruction: string; // Natural language instruction (e.g., "make this async")
  language?: string; // Optional: typescript, javascript, python, etc.
  context?: string[]; // Optional: additional context files
}

export class TestRunDto {
  testPath?: string;
  testCommand?: string;
  watch?: boolean;
}

export class DeploymentDto {
  environment: 'preview' | 'production';
  branch?: string;
  commitMessage?: string;
}

export class CodeAnalysisDto {
  filePath: string;
  analysisType: 'lint' | 'security' | 'performance' | 'suggestions';
}

export class FileTreeDto {
  rootPath?: string;
  depth?: number;
  includeHidden?: boolean;
}

export class ImagePreviewDto {
  filePath: string;
  maxWidth?: number;
  maxHeight?: number;
}
