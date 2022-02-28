import {
    hyperlink,
    SlashCommandBuilder,
    SlashCommandStringOption,
} from "@discordjs/builders";
import {
    CacheType,
    CommandInteraction,
    Guild,
    GuildMember,
    ReactionCollector,
} from "discord.js";
import {Config} from "../config";
import {
    FindOne,
    InsertOne,
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
import {GetColumn, GetUserData} from "../helpers/sheetsAPI";
import {GiveUserRole, RenameUser, TakeUserRole} from "../helpers/userManagement";
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
    deferMode: "EPHEMERAL",
    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        const email = intr.options.getString("email", true).toLowerCase();

        logger.info("Hit");

        // ensure command running in guild
        if (!intr.inGuild()) {
            return SafeReply(intr, NotInGuildResponse());
        }

        // check if user is already verified or someone already used this email
        const existingUser = await FindOne<VerifiedUserType>(verifiedCollection, {
            $or: [{userID: intr.user.id}, {email: email}],
        });
        if (existingUser?.userID === intr.user.id) {
            return SafeReply(
                intr,
                EmbedToMessage(
                    ResponseEmbed()
                        .setTitle(":fire: Already Verified")
                        .setDescription("You're already verified.")
                )
            );
        } else if (existingUser?.email === email) {
            return SafeReply(
                intr,
                EmbedToMessage(
                    ResponseEmbed()
                        .setTitle(":fire: Email Already Used")
                        .setDescription(
                            `It looks like someone is already registered with that email. If this ${"\
                            "} is a mistake, please reach out to a Lead or Admin.`
                        )
                )
            );
        }

        // ensure email is valid
        if (!email.match(emailRegex)) {
            return SafeReply(
                intr,
                EmbedToMessage(
                    ResponseEmbed()
                        .setTitle(":x: Invalid Email")
                        .setDescription(
                            "That doesn't appear to be a valid email address."
                        )
                )
            );
        }

        // get data from sheets API
        const emailColumn = await GetColumn(
            Config.verify.target_sheet_id,
            Config.verify.target_sheet,
            Config.verify.email_column
        );

        // find the last index of the input email, if it exists (case insensitive)
        let emailIndex = -1;
        for (let index = emailColumn.length - 1; index >= 0; index--) {
            if (email === emailColumn[index].toLowerCase()) {
                emailIndex = index;
                break;
            }
        }

        // email not in column, this user should not be verified
        if (emailIndex === -1) {
            return SafeReply(
                intr,
                EmbedToMessage(
                    ResponseEmbed()
                        .setTitle(":x: Verification Failed")
                        .setDescription(
                            `I couldn't verify that email address. If you haven't registered, you can ${hyperlink(
                                "register here",
                                Config.verify.registration_url
                            )}.`
                        )
                )
            );
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

        // verification went OK
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
            // verification failed
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
    const verifiedUser: VerifiedUserType = {
        userID: member.id,
        verifiedAt: Date.now(),
        email: email,
        cardInfo: userData,
    };

    // look up the role we may need to give
    const verRole = guild.roles.cache.findKey(
        (r) => r.name === Config.verify.verified_role_name
    );

    let oldNick = member.nickname;
    let roleGiven = false;
    let nickChanged = false;

    const error = await WithTransaction(
        async (session) => {
            const insertFail = "Could not insert new verified user";
            const insertion = InsertOne<VerifiedUserType>(
                verifiedCollection,
                verifiedUser,
                {
                    session,
                }
            );

            // if there is no role to add in the config, just return the insert result
            if (!Config.verify.verified_role_name) {
                return (await insertion) ? "" : insertFail;
            } else if (!verRole) {
                // if there is a role but it wasn't found, that's an error
                return "Role could not be found";
            }

            // give verified role
            const giveUserRoleErr = await GiveUserRole(member, verRole);
            if (giveUserRoleErr) {
                return giveUserRoleErr;
            }
            roleGiven = true;

            // nickname user if they are not owner
            if (member.id !== guild.ownerId) {
                const giveNickErr = await RenameUser(
                    member,
                    `${userData.firstName} ${userData.lastName}`
                );
                if (giveNickErr) {
                    return giveNickErr;
                }
            }
            nickChanged = true;

            return "";
        },
        async (err) => {
            if (roleGiven) {
                await TakeUserRole(member, verRole!);
                logger.error(
                    `An error occurred while updating ${PrettyUser(
                        member.user
                    )}'s roles: ${err}`
                );
            }

            if (nickChanged) {
                await RenameUser(member, oldNick);
                logger.error(
                    `An error occurred while updating ${PrettyUser(
                        member.user
                    )}'s nickname: ${err}`
                );
            }
        }
    );

    return !error;
};

export {verifyModule as command};
