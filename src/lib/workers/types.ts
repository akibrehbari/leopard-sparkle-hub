export interface Worker {
  _id: string;
  name: string;
  loginUsername: string;
  assignedInfluencerIds: string[];
  createdAt: string;
}

export interface CreateWorkerBody {
  name: string;
  loginUsername: string;
  loginPassword: string;
  assignedInfluencerIds?: string[];
}

export interface UpdateWorkerBody {
  name?: string;
  loginUsername?: string;
  loginPassword?: string;
  assignedInfluencerIds?: string[];
}
