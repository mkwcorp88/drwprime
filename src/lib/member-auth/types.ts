export type MemberClientUser = {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string;
  imageUrl: string | null;
  isTeamLeader: boolean;
};

export type MemberEnrollment = {
  stage: 'register' | 'activate';
  phone: string;
};
