import { BaseController } from './BaseController';
import {
  ProductListService,
  AddItemInput,
  CreateListInput,
} from '../services/ProductListService';
import { ProductListStatus } from '../database/schema';

export class ProductListController extends BaseController<ProductListService> {
  constructor(service: ProductListService) {
    super(service);
  }

  async getAll(status?: ProductListStatus) {
    try {
      const lists = await this.service.findAllWithCounts(status);
      return this.wrapSuccess(lists);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getById(id: number) {
    try {
      const list = await this.service.findByIdWithItems(id);
      if (!list) {
        return { success: false, error: 'List not found' };
      }
      return this.wrapSuccess(list);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async searchForSelect(query: string, limit = 20) {
    try {
      const lists = await this.service.searchOpenLists(query, limit);
      return this.wrapSuccess(lists);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async create(data: CreateListInput) {
    try {
      const list = await this.service.createList(data);
      return this.wrapSuccess(list);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(id: number, data: { title?: string; note?: string | null }) {
    try {
      const list = await this.service.updateList(id, data);
      if (!list) {
        return { success: false, error: 'List not found' };
      }
      return this.wrapSuccess(list);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(id: number) {
    try {
      await this.service.delete(id);
      return this.wrapSuccess({ deleted: true });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async setStatus(id: number, status: ProductListStatus) {
    try {
      const list = await this.service.setStatus(id, status);
      if (!list) {
        return { success: false, error: 'List not found' };
      }
      return this.wrapSuccess(list);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async addItem(listId: number, item: AddItemInput) {
    try {
      const result = await this.service.addItem(listId, item);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createWithItem(list: CreateListInput, item: AddItemInput) {
    try {
      const result = await this.service.createListWithItem(list, item);
      return this.wrapSuccess(result);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateItem(itemId: number, data: { note?: string | null }) {
    try {
      const item = await this.service.updateItem(itemId, data);
      if (!item) {
        return { success: false, error: 'List item not found' };
      }
      return this.wrapSuccess(item);
    } catch (error) {
      return this.handleError(error);
    }
  }

  async removeItem(itemId: number) {
    try {
      await this.service.removeItem(itemId);
      return this.wrapSuccess({ removed: true });
    } catch (error) {
      return this.handleError(error);
    }
  }

  async reorderItems(listId: number, orderedIds: number[]) {
    try {
      await this.service.reorderItems(listId, orderedIds);
      return this.wrapSuccess({ reordered: true });
    } catch (error) {
      return this.handleError(error);
    }
  }
}
