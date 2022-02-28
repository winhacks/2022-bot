# MongoDB Database Layout

Note that unless explicitly stated, there is an additional `_id` property on each type stored in the database. This is required by MongoDB, however in most cases this application just lets MongoDB create the `_id` itself.

## teams Collection

Stores information about the teams that have been registered. Each document in this collection conforms to the following type:

```ts
type TeamType = {
    name: string;
    stdName: string;
    textChannel: string;
    voiceChannel: string;
    members: string[];
    pendingInvites: string[];
};
```

-   `name` is the plain-text name of the team. It is the exact name entered by the user in the `/team create` command.
-   `stdName` is a standardized format of `name`. It is strictly lowercase, and spaces are replaced with hyphens. It is to be used in searches where uniqueness is required.
-   `textChannel` is the Discord snowflake of the text channel associated with the team.
-   `voiceChannel` is the Discord snowflake of the voice channel associated with the team.
-   `members` is an array of Discord user IDs, each of which is a member in the team.
-   `pendingInvites` is an array of Discord message snowflakes, representing the messages that have been sent to users as invites to join the team.

## channelCategories Collection

Stores information about the categories that have been created for teams in Discord. This is required as there is a 50 channel limit on Discord channel categories. Each document in this collection is very simple:

```ts
type CategoryType = {
    category_id: string;
    teamCount: number;
};
```

-   `category_id` is the Discord snowflake representing the category.
-   `teamCount` is the number of teams that have been placed under this category. Note that this is not the number of channels, but the number of teams. If each team has 2 channels, only up to 25 teams may be included in a category.
