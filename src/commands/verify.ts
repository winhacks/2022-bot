import {
    hyperlink,
    SlashCommandBooleanOption,
    SlashCommandBuilder,
    SlashCommandStringOption,
} from "@discordjs/builders";
import {CacheType, Collection, CommandInteraction, Guild, GuildMember} from "discord.js";
import {Config} from "../config";
import {
    FindAndRemove,
    FindAndUpdate,
    FindOne,
    InsertOne,
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
import {GetColumn, GetUserData} from "../helpers/sheetsAPI";
import {logger} from "../logger";
import {CardInfoType, CommandType, VerifiedUserType} from "../types";
import {NotInGuildResponse} from "./team/team-shared";

// source: https://www.emailregex.com/ (apparently 99.99% accurate)
const emailRegex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const verifyModule: CommandType = {
    data: new SlashCommandBuilder() //
        .setName("verify")
        .setDescription("Verify yourself.")
        .addStringOption(
            new SlashCommandStringOption()
                .setName("email")
                .setDescription("The email you registered with")
                .setRequired(true)
        ),
    ephemeral: true,
    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        const email = intr.options.getString("email", true);

        // ensure command running in guild
        if (!intr.inGuild()) {
            return SafeReply(intr, NotInGuildResponse());
        }

        // check if user is already verified
        const existingUser = await FindOne<VerifiedUserType>(verifiedCollection, {
            userID: intr.user.id,
        });
        if (existingUser) {
            return SafeReply(intr, {
                embeds: [
                    ResponseEmbed()
                        .setTitle(":fire: Already Verified")
                        .setDescription("You're already verified."),
                ],
            });
        }

        // ensure email is valid
        if (!email.match(emailRegex)) {
            return SafeReply(intr, {
                embeds: [
                    ResponseEmbed()
                        .setTitle(":x: Invalid Email")
                        .setDescription(
                            "That doesn't appear to be a valid email address."
                        ),
                ],
            });
        }

        // get data from sheets API
        const emailColumn = await GetColumn(
            Config.verify.target_sheet_id,
            Config.verify.target_sheet,
            Config.verify.email_column
        );
        let emailIndex = emailColumn.lastIndexOf(email);

        // email not in column, this user should not be verified
        if (emailIndex === -1) {
            return SafeReply(intr, {
                embeds: [
                    ResponseEmbed()
                        .setTitle(":x: Verification Failed")
                        .setDescription(
                            `I couldn't verify that email address. If you haven't registered, you can ${hyperlink(
                                "register here",
                                Config.verify.registration_url
                            )}.`
                        ),
                ],
            });
        }

        // verify user
        const result = await DoVerifyUser(
            intr.guild!,
            intr.member as GuildMember,
            email,
            await GetUserData(
                Config.verify.target_sheet_id,
                Config.verify.target_sheet,
                1 + emailIndex
            )
        );

        if (result) {
            logger.info(`Verified "${PrettyUser(intr.user)}" with ${email}`);
            if (intr.user.id !== intr.guild?.ownerId) {
                return SafeReply(intr, SuccessResponse("You are now verified."));
            } else {
                logger.warn(
                    `${PrettyUser(
                        intr.user
                    )} is the guild owner, asking them to update their nick manually.`
                );
                return SafeReply(
                    intr,
                    SuccessResponse(
                        `You are now verified. As the guild owner, you'll need to change your ${"\
                        "}nickname to your real name manually. Ask the Discord developers why, not me.`
                    )
                );
            }
        } else {
            return SafeReply(intr, GenericError());
        }
    },
};

const DoVerifyUser = async (
    guild: Guild,
    member: GuildMember,
    email: string,
    userData: CardInfoType
): Promise<boolean> => {
    return WithTransaction(async (session) => {
        const verifiedUser: VerifiedUserType = {
            userID: member.id,
            verifiedAt: Date.now(),
            email: email,
            cardInfo: userData,
        };

        const insertion = InsertOne<VerifiedUserType>(verifiedCollection, verifiedUser, {
            session,
        });

        // no role to add, stop here
        if (!Config.verify.verified_role_name) {
            return insertion;
        }

        // look up the role
        const verRole = guild.roles.cache.findKey(
            (r) => r.name === Config.verify.verified_role_name
        );

        // try to update role, catch any error and cancel transaction
        let nicked = false;
        try {
            // role not found, that's an error
            if (!verRole) {
                throw new Error(`Role not found: ${Config.verify.verified_role_name}`);
            }

            // await completion to ensure no error occurs
            if (member.id !== guild.ownerId) {
                await member.setNickname(`${userData.firstName} ${userData.lastName}`);
            }
            nicked = true;

            await member.roles.add(verRole);
        } catch (err) {
            if (nicked) {
                logger.error(
                    `An error occurred while updating ${PrettyUser(
                        member.user
                    )}'s roles: ${err}`
                );
            } else {
                logger.error(
                    `An error occurred while updating ${PrettyUser(
                        member.user
                    )}'s nickname: ${err}`
                );
            }

            return false;
        }

        return insertion;
    });
};

export {verifyModule as command};
