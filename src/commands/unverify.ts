import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction, GuildMember} from "discord.js";
import {Config} from "../config";
import {
    FindAndRemove,
    FindOne,
    verifiedCollection,
    WithTransaction,
} from "../helpers/database";
import {
    GenericError,
    ResponseEmbed,
    SafeReply,
    SuccessResponse,
} from "../helpers/responses";
import {CommandType, VerifiedUserType} from "../types";
import {NotInGuildResponse} from "./team/team-shared";

const unverifyModule: CommandType = {
    data: new SlashCommandBuilder() //
        .setName("unverify")
        .setDescription("Unverify yourself. You'll need to `/verify` again."),
    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        if (!intr.inGuild()) {
            return SafeReply(intr, NotInGuildResponse());
        }

        const guild = intr.guild!;
        const user = intr.member! as GuildMember;

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

        const res = await WithTransaction(async () => {
            const remove = await FindAndRemove(verifiedCollection, {userID: user.id});
            if (!remove) {
                return false;
            }

            const verRole = guild.roles.cache.findKey(
                (r) => r.name === Config.verify.verified_role_name
            );

            if (Config.verify.verified_role_name && !verRole) {
                return false;
            }

            await user.roles.remove(verRole!);
            return true;
        });

        if (res) {
            return SafeReply(intr, SuccessResponse("You've been un-verified."));
        } else {
            return SafeReply(intr, GenericError());
        }
    },
};

export {unverifyModule as command};
