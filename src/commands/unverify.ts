import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction, Guild, GuildMember} from "discord.js";
import {P} from "pino";
import {Config} from "../config";
import {
    FindAndRemove,
    FindOne,
    teamCollection,
    verifiedCollection,
    WithTransaction,
} from "../helpers/database";
import {PrettyUser} from "../helpers/misc";
import {
    EmbedToMessage,
    GenericError,
    ResponseEmbed,
    SafeReply,
    SuccessResponse,
} from "../helpers/responses";
import {GiveUserRole, TakeUserRole} from "../helpers/userManagement";
import {logger} from "../logger";
import {CommandType, TeamType, VerifiedUserType} from "../types";
import {NotInGuildResponse} from "./team/team-shared";

const unverifyModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("unverify")
        .setDescription("Unverify yourself. You'll need to /verify again."),
    deferMode: "EPHEMERAL",
    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        if (!intr.inGuild()) {
            return SafeReply(intr, NotInGuildResponse());
        }

        // check for existing user
        const existing = await FindOne<VerifiedUserType>(verifiedCollection, {
            userID: intr.user.id,
        });
        if (!existing) {
            return SafeReply(
                intr,
                EmbedToMessage(
                    ResponseEmbed()
                        .setTitle(":x: Not Verified")
                        .setDescription(
                            "You're not verified yet. Did you mean to use `/verify`?"
                        )
                )
            );
        }

        // check if user is in team
        const userTeam = await FindOne<TeamType>(teamCollection, {members: intr.user.id});
        if (userTeam) {
            return SafeReply(
                intr,
                EmbedToMessage(
                    ResponseEmbed()
                        .setTitle(":x: In Team")
                        .setDescription(
                            "You cannot unverify while in a team. Use `/team leave` first."
                        )
                )
            );
        }

        const guild = intr.guild!;
        const member = intr.member! as GuildMember;
        const res = await HandleUnverify(guild, member);

        if (res) {
            intr.client.emit("userUnverified");
            logger.info(`Un-verified ${PrettyUser(intr.user)}`);
            return SafeReply(intr, SuccessResponse("You're no longer verified."));
        } else {
            return SafeReply(intr, GenericError());
        }
    },
};

const HandleUnverify = async (guild: Guild, member: GuildMember): Promise<boolean> => {
    const verRole = guild.roles.cache.findKey(
        (r) => r.name === Config.verify.verified_role_name
    );

    if (Config.verify.verified_role_name && !verRole) {
        return false;
    }

    let roleTaken = false;
    const error = await WithTransaction(
        async (session) => {
            // start dropping the verified user record
            const dropFail = "Could not drop verified user from database";
            const remove = FindAndRemove(
                verifiedCollection,
                {userID: member.id},
                {session}
            );

            // if there is no role to remove in the config, just return the drop result
            if (!Config.verify.verified_role_name) {
                return (await remove) ? "" : dropFail;
            } else if (!verRole) {
                // if there is a role but it wasn't found, that's an error
                return "Role could not be found";
            }

            const takeUserRoleErr = await TakeUserRole(member, verRole);
            if (takeUserRoleErr) {
                return takeUserRoleErr;
            }

            roleTaken = true;
            return (await remove) ? "" : dropFail;
        },
        async (error: string): Promise<void> => {
            if (roleTaken) {
                await GiveUserRole(member, verRole!);
            }

            logger.error(
                `An error occurred while removing roles from ${PrettyUser(
                    member.user
                )}: ${error}`
            );
        }
    );

    return !error;
};
export {unverifyModule as command};
