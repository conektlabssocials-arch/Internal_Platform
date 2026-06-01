import { inject, injectable } from 'tsyringe';
import { Types } from 'mongoose';

import { TOKENS } from '../config/tokens.js';
import { mapUserToDto } from '../dto/user.dto.js';
import type { CreateUserDto, UpdateUserDto, UserDto } from '../dto/user.dto.js';
import type { UserDocument, UserRole, UserStatus } from '../models/user.model.js';
import type { IUserRepository } from '../repositories/user.repository.js';
import { HttpError } from '../utils/httpError.js';

export interface IUserService {
  listUsers(): Promise<UserDto[]>;
  getUserById(id: string): Promise<UserDocument>;
  getActiveUserDtoById(id: string): Promise<UserDto>;
  getActiveUserByEmail(email: string): Promise<UserDocument>;
  recordLoginByEmail(email: string): Promise<UserDto>;
  createUser(input: CreateUserDto): Promise<UserDto>;
  updateUser(id: string, input: UpdateUserDto): Promise<UserDto>;
  setUserStatus(id: string, status: UserStatus, updatedBy?: string): Promise<UserDto>;
}

const allowedRoles: UserRole[] = ['admin', 'member'];
const allowedStatuses: UserStatus[] = ['active', 'inactive'];

const normalizeEmail = (email: string) => email.trim().toLowerCase();

@injectable()
export class UserService implements IUserService {
  constructor(
    @inject(TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
  ) {}

  async listUsers() {
    const users = await this.userRepository.findAllSortedByCreatedAt();
    return users.map(mapUserToDto);
  }

  async getUserById(id: string) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    return user;
  }

  async getActiveUserByEmail(email: string) {
    const user = await this.userRepository.findByEmail(normalizeEmail(email));

    if (!user) {
      throw new HttpError(401, 'User is not allowed to access this system');
    }

    if (user.status !== 'active') {
      throw new HttpError(403, 'User is inactive');
    }

    return user;
  }

  async getActiveUserDtoById(id: string) {
    const user = await this.getUserById(id);

    if (user.status !== 'active') {
      throw new HttpError(403, 'User is inactive');
    }

    return mapUserToDto(user);
  }

  async recordLoginByEmail(email: string) {
    const user = await this.getActiveUserByEmail(email);
    user.lastLoginAt = new Date();

    const savedUser = await this.userRepository.save(user);
    return mapUserToDto(savedUser);
  }

  async createUser(input: CreateUserDto) {
    const name = input.name?.trim();
    const email = input.email ? normalizeEmail(input.email) : '';
    const role = input.role || 'member';

    if (!name || !email) {
      throw new HttpError(400, 'Name and email are required');
    }

    if (!allowedRoles.includes(role)) {
      throw new HttpError(400, 'Role must be admin or member');
    }

    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new HttpError(409, 'A user with this email already exists');
    }

    const user = await this.userRepository.create({
      name,
      email,
      role,
      status: 'active',
      createdBy: input.createdBy ? new Types.ObjectId(input.createdBy) : undefined,
      updatedBy: input.createdBy ? new Types.ObjectId(input.createdBy) : undefined,
    });

    return mapUserToDto(user);
  }

  async updateUser(id: string, input: UpdateUserDto) {
    const user = await this.getUserById(id);

    if (input.name !== undefined) {
      const name = input.name.trim();

      if (!name) {
        throw new HttpError(400, 'Name cannot be empty');
      }

      user.name = name;
    }

    if (input.email !== undefined) {
      const email = normalizeEmail(input.email);

      if (!email) {
        throw new HttpError(400, 'Email cannot be empty');
      }

      const existingUser = await this.userRepository.findDuplicateEmail(email, id);

      if (existingUser) {
        throw new HttpError(409, 'A user with this email already exists');
      }

      user.email = email;
    }

    if (input.role !== undefined) {
      if (!allowedRoles.includes(input.role)) {
        throw new HttpError(400, 'Role must be admin or member');
      }

      user.role = input.role;
    }

    if (input.status !== undefined) {
      if (!allowedStatuses.includes(input.status)) {
        throw new HttpError(400, 'Status must be active or inactive');
      }

      user.status = input.status;
    }

    if (input.updatedBy) {
      user.updatedBy = new Types.ObjectId(input.updatedBy);
    }

    const savedUser = await this.userRepository.save(user);
    return mapUserToDto(savedUser);
  }

  setUserStatus(id: string, status: UserStatus, updatedBy?: string) {
    return this.updateUser(id, { status, updatedBy });
  }
}
