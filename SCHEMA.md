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

By default, the data is broken into 3 collections:

-   `users`, which stores users and their verification info (`VerifiedUserType` and `CardInfoType`)
-   `teams`, which stores the teams (`TeamType` and `InviteType`)
-   `categories`, which stores the team categories (`CategoryType`)

If the same database is used for the bot when it is in development mode, there will be copies of each of the above categories with `_development` appended to the name. They store the same kinds of information, but `_development` is only to be used by the bot in development and the non-`_development` categories are only to be used by the production bot.
