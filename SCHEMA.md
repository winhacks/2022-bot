# MongoDB Schema

```ts
export interface TeamType {
    name: string;
    stdName: string; // a standardized name format for checking availability
    textChannel: string;
    voiceChannel: string;
    members: string[];
    invites: InviteType[];
}

export interface InviteType {
    teamName: string;
    inviteID: string;
    invitee: string;
}

export interface CategoryType {
    categoryID: string;
    teamCount: number;
}

export interface VerifiedUserType {
    userID: string;
    verifiedAt: number;
    email: string;
    cardInfo: CardInfoType;
}

export interface CardInfoType {
    authorizedCard: boolean;
    firstName?: string;
    lastName?: string;
    pronouns?: string;
    github?: string;
    website?: string;
    resume?: string;
    linkedIn?: string;
    studyArea?: string;
    studyLocation?: string;
    phone?: string;
    email?: string;
}
```
