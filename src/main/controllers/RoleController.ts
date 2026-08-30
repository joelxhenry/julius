import { BaseController } from './BaseController';
import { RoleService } from '../services/RoleService';
import * as schema from '../database/schema';

export class RoleController extends BaseController<RoleService> {
  constructor(service: RoleService) {
    super(service);
  }

  async getAll() {
    try {
      const roles = await this.service.findAllOrdered();
      return this.wrapSuccess(roles);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const role = await this.service.findById(id);
      if (!role) return { success: false, error: 'Role not found' };
      return this.wrapSuccess(role);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: schema.InsertRole) {
    try {
      if (!data.name || !data.name.trim()) {
        return { success: false, error: 'Role name is required' };
      }
      const existing = await this.service.findByName(data.name);
      if (existing) {
        return { success: false, error: `A role named "${data.name}" already exists` };
      }
      const role = await this.service.create(data);
      return this.wrapSuccess(role);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: Partial<schema.InsertRole>) {
    try {
      // Prevent renaming to a name already used by a different role.
      if (data.name) {
        const existing = await this.service.findByName(data.name);
        if (existing && existing.id !== id) {
          return { success: false, error: `A role named "${data.name}" already exists` };
        }
      }
      const role = await this.service.update(id, data);
      if (!role) return { success: false, error: 'Role not found' };
      return this.wrapSuccess(role);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(id: number) {
    try {
      const role = await this.service.findById(id);
      if (!role) return { success: false, error: 'Role not found' };
      if (role.isSystem) {
        return { success: false, error: 'System roles cannot be deleted' };
      }
      const assigned = await this.service.countAssignedEmployees(id);
      if (assigned > 0) {
        return {
          success: false,
          error: `This role is assigned to ${assigned} employee(s). Reassign them before deleting.`,
        };
      }
      await this.service.delete(id);
      return this.wrapSuccess({ deleted: true });
    } catch (error) {
      return this.handleError(error);
    }
  }
}
