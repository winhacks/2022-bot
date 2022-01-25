import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction, Guild, GuildMember} from "discord.js";
import {Config} from "../config";
import {
    FindAndRemove,
    FindOne,
    verifiedCollection,
    WithTransaction,
} from "../helpers/database";
import {PrettyUser} from "../helpers/misc";
import {
    GenericError,
    ResponseEmbed,
    SafeReply,
    SuccessResponse,
} from "../helpers/responses";
import {logger} from "../logger";
import {CommandType, VerifiedUserType} from "../types";
import {NotInGuildResponse} from "./team/team-shared";

const unverifyModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("unverify")
        .setDescription("Unverify yourself. You'll need to /verify again."),
    ephemeral: true,

    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        if (!intr.inGuild()) {
            return SafeReply(intr, NotInGuildResponse());
        }

        // check for existing user
        const existing = await FindOne<VerifiedUserType>(verifiedCollection, {
            userID: intr.user.id,
        });
        if (!existing) {
            return SafeReply(intr, {
                embeds: [
                    ResponseEmbed()
                        .setTitle(":x: Not Verified")
                        .setDescription(
                            "You're not verified yet. Did you mean to use `/verify`?"
                        ),
                ],
            });
        }

        const guild = intr.guild!;
        const member = intr.member! as GuildMember;
        const res = await HandleUnverify(guild, member);

        if (res) {
            logger.info(`Un-verified ${PrettyUser(intr.user)}`);
            return SafeReply(intr, SuccessResponse("You're no longer verified."));
        } else {
            return SafeReply(intr, GenericError());
        }
    },
};

const HandleUnverify = async (guild: Guild, member: GuildMember) => {
    return WithTransaction(async (session) => {
        const findQuery = {userID: member.id};
        logger.info(findQuery);
        const remove = FindAndRemove(verifiedCollection, findQuery, {session});

        // no role to take, stop here
        if (!Config.verify.verified_role_name) {
            return remove;
        }

        const verRole = guild.roles.cache.findKey(
            (r) => r.name === Config.verify.verified_role_name
        );

        // try to remove role, await any errors
        try {
            // role not found
            if (!verRole) {
                throw new Error(`Role not found: ${Config.verify.verified_role_name}`);
            }

            await member.roles.remove(verRole);
        } catch (err) {
            logger.error(
                `An error occurred while removing roles from ${PrettyUser(
                    member.user
                )}: ${err}`
            );

            return false;
        }

        const dbRes = await remove;
        if (!dbRes) {
            await member.roles.add(verRole);
        }

        return dbRes;
    });
};
export {unverifyModule as command};
