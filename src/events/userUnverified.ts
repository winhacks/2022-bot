import {GuildMember} from "discord.js";
import {HandleLeaveTeam} from "../commands/team/team-shared";
import {FindOne, teamCollection} from "../helpers/database";
import {SelectPlural} from "../helpers/misc";
import {GetVerifiedCount, SetVerifiedCount} from "../helpers/userManagement";
import {logger} from "../logger";
import {ClientType, EventType, TeamType} from "../types";

const userUnverifiedModule: EventType = {
    eventName: "userUnverified",
    once: false,
    execute: async (client: ClientType, member: GuildMember) => {
        // find and leave team
        const team = await FindOne<TeamType>(teamCollection, {members: member.id});
        if (team) {
            // leave team
            const leaveError = await HandleLeaveTeam(member.guild, member.user, team);
            if (leaveError) {
                logger.error(leaveError);
            }
        }

        // update presence to reflect 1 less verified hacker
        const registeredCount = SetVerifiedCount((await GetVerifiedCount()) - 1);
        const message = SelectPlural(
            registeredCount,
            "nobody 😦",
            "1 verified hacker",
            `${registeredCount} verified hackers`
        );

        client.user?.setPresence({
            status: "online",
            activities: [{type: "WATCHING", name: message}],
        });
    },
};

export {userUnverifiedModule as event};
