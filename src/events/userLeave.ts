import {GuildMember} from "discord.js";
import {FindAndRemove, verifiedCollection} from "../helpers/database";
import {logger} from "../logger";
import {ClientType, EventType} from "../types";

const memberLeaveModule: EventType = {
    eventName: "guildMemberRemove",
    once: false,
    execute: async (client: ClientType, member: GuildMember) => {
        const unverifyResult = await FindAndRemove(verifiedCollection, {
            userID: member.id,
        });

        if (unverifyResult) {
            logger.info(`User ${member.id} left and was unverified.`);
            client.emit("userUnverified", member);
        } else {
            logger.info(`User ${member.id} left.`);
        }
    },
};

export {memberLeaveModule as event};
