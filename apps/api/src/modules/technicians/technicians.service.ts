import { techniciansRepository } from './technicians.repository';
import type {
  TechnicianQueryFilter,
  CreateTechnicianInput,
  UpdateTechnicianInput,
} from '@crm/validation';

export class TechniciansService {
  async getTechnicians(filters: TechnicianQueryFilter) {
    return techniciansRepository.findPaginated(filters);
  }

  async getTechnicianById(id: string) {
    const tech = await techniciansRepository.findById(id);
    if (!tech) {
      throw new Error('Technician not found');
    }
    return tech;
  }

  async getTechnician360Profile(id: string) {
    const profile = await techniciansRepository.getTechnician360AdminProfile(id);
    if (!profile) {
      throw new Error('Technician not found');
    }
    return profile;
  }

  async getKPIs() {
    return techniciansRepository.getKPIs();
  }

  async createTechnician(input: CreateTechnicianInput, actorId?: string) {
    return techniciansRepository.create(input, actorId);
  }

  async updateTechnician(id: string, input: UpdateTechnicianInput, actorId?: string) {
    return techniciansRepository.update(id, input, actorId);
  }

  async deleteTechnician(id: string, actorId?: string) {
    return techniciansRepository.delete(id, actorId);
  }

  async togglePortalAccess(id: string, portalEnabled: boolean, actorId?: string) {
    return techniciansRepository.setPortalAccess(id, portalEnabled, actorId);
  }
}

export const techniciansService = new TechniciansService();
