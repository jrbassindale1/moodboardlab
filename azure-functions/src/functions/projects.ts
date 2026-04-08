/**
 * Projects Function
 *
 * CRUD operations for project management.
 * All operations require authentication.
 *
 * Routes:
 * - GET /api/projects - List all projects for authenticated user
 * - GET /api/projects/:id - Get a single project by ID
 * - POST /api/projects - Create a new project
 * - PUT /api/projects/:id - Update an existing project
 * - DELETE /api/projects/:id - Soft delete a project
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, ValidatedUser } from '../shared/validateToken';
import {
  getContainer,
  ProjectDocument,
  ProjectType,
  ProjectStage,
  ProjectEntryRoute,
  isCosmosNotFound,
} from '../shared/cosmosClient';

const PROJECT_TYPES: ProjectType[] = ['Residential', 'Commercial', 'Education', 'Mixed-Use', 'Cultural', 'Landscape'];
const PROJECT_STAGES: ProjectStage[] = ['Concept', 'Scheme', 'Detailed', 'Planning'];
const ENTRY_ROUTES: ProjectEntryRoute[] = ['materials', 'sketch', 'place', 'mood'];

function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function validateProjectInput(body: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
  data: Partial<ProjectDocument>;
} {
  const errors: string[] = [];
  const data: Partial<ProjectDocument> = {};

  // Name is required
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push('Name is required');
  } else if (body.name.length > 255) {
    errors.push('Name must be 255 characters or less');
  } else {
    data.name = body.name.trim();
  }

  // Type is optional but must be valid if provided
  if (body.type !== undefined && body.type !== null) {
    if (!PROJECT_TYPES.includes(body.type as ProjectType)) {
      errors.push(`Type must be one of: ${PROJECT_TYPES.join(', ')}`);
    } else {
      data.type = body.type as ProjectType;
    }
  }

  // Location is optional
  if (body.location !== undefined && body.location !== null) {
    if (typeof body.location !== 'string') {
      errors.push('Location must be a string');
    } else if (body.location.length > 255) {
      errors.push('Location must be 255 characters or less');
    } else {
      data.location = body.location.trim() || null;
    }
  }

  // Stage is optional but must be valid if provided
  if (body.stage !== undefined && body.stage !== null) {
    if (!PROJECT_STAGES.includes(body.stage as ProjectStage)) {
      errors.push(`Stage must be one of: ${PROJECT_STAGES.join(', ')}`);
    } else {
      data.stage = body.stage as ProjectStage;
    }
  }

  // Brief is optional
  if (body.brief !== undefined && body.brief !== null) {
    if (typeof body.brief !== 'string') {
      errors.push('Brief must be a string');
    } else {
      data.brief = body.brief.trim() || null;
    }
  }

  // Entry route is optional but must be valid if provided
  if (body.entryRoute !== undefined && body.entryRoute !== null) {
    if (!ENTRY_ROUTES.includes(body.entryRoute as ProjectEntryRoute)) {
      errors.push(`Entry route must be one of: ${ENTRY_ROUTES.join(', ')}`);
    } else {
      data.entryRoute = body.entryRoute as ProjectEntryRoute;
    }
  }

  // Settings is optional - future-proofing
  if (body.settings !== undefined && body.settings !== null) {
    if (typeof body.settings !== 'object') {
      errors.push('Settings must be an object');
    } else {
      data.settings = body.settings as Record<string, unknown>;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data,
  };
}

/**
 * List all projects for the authenticated user
 */
async function listProjects(
  user: ValidatedUser,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const projectsContainer = getContainer('projects');

    const querySpec = {
      query: `
        SELECT c.id, c.name, c.type, c.location, c.stage, c.brief, c.entryRoute, c.createdAt, c.updatedAt
        FROM c
        WHERE c.userId = @userId AND (c.deletedAt = null OR NOT IS_DEFINED(c.deletedAt))
        ORDER BY c.updatedAt DESC
      `,
      parameters: [{ name: '@userId', value: user.userId }],
    };

    const { resources } = await projectsContainer.items
      .query<ProjectDocument>(querySpec, { partitionKey: user.userId })
      .fetchAll();

    return {
      status: 200,
      body: JSON.stringify({ items: resources }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    context.error('Error listing projects:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

/**
 * Get a single project by ID
 */
async function getProject(
  user: ValidatedUser,
  projectId: string,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const projectsContainer = getContainer('projects');

    const { resource } = await projectsContainer
      .item(projectId, user.userId)
      .read<ProjectDocument>();

    if (!resource || resource.deletedAt) {
      return {
        status: 404,
        body: JSON.stringify({ error: 'Project not found' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Verify ownership
    if (resource.userId !== user.userId) {
      return {
        status: 403,
        body: JSON.stringify({ error: 'Forbidden' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    return {
      status: 200,
      body: JSON.stringify(resource),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    if (isCosmosNotFound(error)) {
      return {
        status: 404,
        body: JSON.stringify({ error: 'Project not found' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }
    context.error('Error getting project:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

/**
 * Create a new project
 */
async function createProject(
  user: ValidatedUser,
  body: Record<string, unknown>,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const validation = validateProjectInput(body);
  if (!validation.valid) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'Validation failed', errors: validation.errors }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const projectsContainer = getContainer('projects');
    const now = new Date().toISOString();

    const project: ProjectDocument = {
      id: generateProjectId(),
      userId: user.userId,
      name: validation.data.name!,
      type: validation.data.type || null,
      location: validation.data.location || null,
      stage: validation.data.stage || null,
      brief: validation.data.brief || null,
      entryRoute: validation.data.entryRoute || null,
      settings: validation.data.settings || null,
      createdAt: now,
      updatedAt: now,
    };

    const { resource } = await projectsContainer.items.create(project);

    return {
      status: 201,
      body: JSON.stringify(resource),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    context.error('Error creating project:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

/**
 * Update an existing project
 */
async function updateProject(
  user: ValidatedUser,
  projectId: string,
  body: Record<string, unknown>,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const validation = validateProjectInput(body);
  if (!validation.valid) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'Validation failed', errors: validation.errors }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const projectsContainer = getContainer('projects');

    // Fetch existing project
    const { resource: existing } = await projectsContainer
      .item(projectId, user.userId)
      .read<ProjectDocument>();

    if (!existing || existing.deletedAt) {
      return {
        status: 404,
        body: JSON.stringify({ error: 'Project not found' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Verify ownership
    if (existing.userId !== user.userId) {
      return {
        status: 403,
        body: JSON.stringify({ error: 'Forbidden' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Update project
    const updated: ProjectDocument = {
      ...existing,
      name: validation.data.name ?? existing.name,
      type: validation.data.type !== undefined ? validation.data.type : existing.type,
      location: validation.data.location !== undefined ? validation.data.location : existing.location,
      stage: validation.data.stage !== undefined ? validation.data.stage : existing.stage,
      brief: validation.data.brief !== undefined ? validation.data.brief : existing.brief,
      entryRoute: validation.data.entryRoute !== undefined ? validation.data.entryRoute : existing.entryRoute,
      settings: validation.data.settings !== undefined ? validation.data.settings : existing.settings,
      updatedAt: new Date().toISOString(),
    };

    const { resource } = await projectsContainer
      .item(projectId, user.userId)
      .replace(updated);

    return {
      status: 200,
      body: JSON.stringify(resource),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    if (isCosmosNotFound(error)) {
      return {
        status: 404,
        body: JSON.stringify({ error: 'Project not found' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }
    context.error('Error updating project:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

/**
 * Soft delete a project
 */
async function deleteProject(
  user: ValidatedUser,
  projectId: string,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const projectsContainer = getContainer('projects');

    // Fetch existing project
    const { resource: existing } = await projectsContainer
      .item(projectId, user.userId)
      .read<ProjectDocument>();

    if (!existing || existing.deletedAt) {
      return {
        status: 404,
        body: JSON.stringify({ error: 'Project not found' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Verify ownership
    if (existing.userId !== user.userId) {
      return {
        status: 403,
        body: JSON.stringify({ error: 'Forbidden' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Soft delete by setting deletedAt
    const updated: ProjectDocument = {
      ...existing,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await projectsContainer.item(projectId, user.userId).replace(updated);

    return {
      status: 200,
      body: JSON.stringify({ success: true, message: 'Project deleted' }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    if (isCosmosNotFound(error)) {
      return {
        status: 404,
        body: JSON.stringify({ error: 'Project not found' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }
    context.error('Error deleting project:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

/**
 * Main handler for all project operations
 */
export async function projects(
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Projects function processed a request.');

  // Require authentication for all operations
  const authResult = await requireAuth(req);
  if ('status' in authResult) {
    return {
      status: authResult.status,
      body: authResult.body,
      headers: { 'Content-Type': 'application/json' },
    };
  }

  const user = authResult as ValidatedUser;
  const method = req.method.toUpperCase();

  // Extract project ID from URL path if present
  // URL format: /api/projects or /api/projects/{id}
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const projectId = pathParts.length > 2 ? pathParts[2] : null;

  try {
    switch (method) {
      case 'GET':
        if (projectId) {
          return await getProject(user, projectId, context);
        }
        return await listProjects(user, context);

      case 'POST':
        const createBody = await req.json() as Record<string, unknown>;
        return await createProject(user, createBody, context);

      case 'PUT':
        if (!projectId) {
          return {
            status: 400,
            body: JSON.stringify({ error: 'Project ID is required' }),
            headers: { 'Content-Type': 'application/json' },
          };
        }
        const updateBody = await req.json() as Record<string, unknown>;
        return await updateProject(user, projectId, updateBody, context);

      case 'DELETE':
        if (!projectId) {
          return {
            status: 400,
            body: JSON.stringify({ error: 'Project ID is required' }),
            headers: { 'Content-Type': 'application/json' },
          };
        }
        return await deleteProject(user, projectId, context);

      default:
        return {
          status: 405,
          body: JSON.stringify({ error: 'Method not allowed' }),
          headers: { 'Content-Type': 'application/json' },
        };
    }
  } catch (error) {
    context.error('Unexpected error in projects handler:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
}

// Register the function with wildcard route to handle all project paths
app.http('projects', {
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  authLevel: 'anonymous',
  route: 'projects/{*projectId}',
  handler: projects,
});
