import {
    ButtonInteraction,
    CacheType,
    CategoryChannel,
    Collection,
    CommandInteraction,
    Guild,
    Message,
    MessageActionRow,
    MessageButton,
    MessageComponentInteraction,
} from "discord.js";
import {Document, PullOperator, PushOperator} from "mongodb";
import {Config} from "../../config";
import {
    FindAndUpdate,
    FindOne,
    teamCollection,
    WithTransaction,
} from "../../helpers/database";
import {
    EmbedToMessage,
    GenericError,
    NotVerifiedResponse,
    ResponseEmbed,
    SafeReply,
    SuccessResponse,
} from "../../helpers/responses";
import {InviteType, TeamType} from "../../types";
import {
    BuildTeamPermissions,
    IsUserVerified,
    NotInGuildResponse,
    NotTeamLeaderResponse,
    TeamFullResponse,
} from "./team-shared";
import {Document as MongoDocument} from "mongodb";
import {Remove, Timestamp} from "../../helpers/misc";
import {MessageButtonStyles} from "discord.js/typings/enums";
import {TimestampStyles} from "@discordjs/builders";
import {logger} from "../../logger";

// FIXME: Need to investigate error caused by inviting member twice
//        (seems to be caused by multiple sessions on MongoDB)

export const InviteToTeam = async (
    intr: CommandInteraction<CacheType>,
    team: TeamType
): Promise<any> => {
    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    } else if (!(await IsUserVerified(intr.user.id))) {
        return SafeReply(intr, NotVerifiedResponse(true));
    }

    if (team.members.length >= Config.teams.max_team_size) {
        return SafeReply(intr, TeamFullResponse());
    }

    const invitee = intr.options.getUser("user", true);

    if (!(await IsUserVerified(invitee.id))) {
        return SafeReply(
            intr,
            EmbedToMessage(
                ResponseEmbed()
                    .setTitle(":x: User Not Verified")
                    .setDescription(
                        "You can only invite verified users to your team. Ask them to verify first with `/verify`."
                    )
            )
        );
    } else if (intr.user.id === invitee.id && !Config.dev_mode) {
        return SafeReply(
            intr,
            EmbedToMessage(
                ResponseEmbed()
                    .setTitle(":confused: You're Already In Your Team")
                    .setDescription(
                        "You tried to invite yourself to your own team. Sadly, cloning hasn't been invented yet."
                    )
            )
        );
    } else if (team.members.includes(invitee.id)) {
        return SafeReply(
            intr,
            EmbedToMessage(
                ResponseEmbed()
                    .setTitle(":confused: Member Already Joined")
                    .setDescription("That user is already a member of your team.")
            )
        );
    } else if (team.invites.findIndex((inv) => inv.invitee === invitee.id) !== -1) {
        return SafeReply(
            intr,
            EmbedToMessage(
                ResponseEmbed()
                    .setTitle(":confused: Member Already Invited")
                    .setDescription(
                        "You already invited that user. Please wait a few minutes before trying again."
                    )
            )
        );
    }

    const inviteDuration = Config.teams.invite_duration * 60_000;
    const invite: InviteType = {
        teamName: team.name,
        invitee: invitee.id,
        inviteID: `${Date.now()}`,
    };
    let message: Message<boolean>;
    const inviteError = await WithTransaction(async (session) => {
        const inviteAdd = await FindAndUpdate<TeamType>(
            teamCollection,
            team,
            {$push: {invites: invite} as unknown as PushOperator<MongoDocument>},
            {session}
        );
        if (!inviteAdd) {
            return "Failed to add invite";
        }

        try {
            const buttonRow = new MessageActionRow().setComponents(
                new MessageButton()
                    .setStyle(MessageButtonStyles.SECONDARY)
                    .setCustomId(`decline#${invite.inviteID}`)
                    .setLabel("Decline"),
                new MessageButton()
                    .setStyle(MessageButtonStyles.PRIMARY)
                    .setCustomId(`accept#${invite.inviteID}`)
                    .setLabel("Accept")
            );
            const inviteMsg = ResponseEmbed()
                .setTitle(":partying_face: You've Been Invited")
                .setDescription(
                    [
                        `You've been invited to join Team ${team.name}'s noble quest to`,
                        `be the best there ever was at ${Config.bot_info.event_name}.`,
                        `This invite expires ${Timestamp(
                            Date.now() + inviteDuration,
                            TimestampStyles.LongDateTime
                        )}.`,
                    ].join(" ")
                );
            message = await invitee.send({
                embeds: [inviteMsg],
                components: [buttonRow],
            });
        } catch (err) {
            return `Failed to invite user: ${err}`;
        }

        return "";
    });

    // message send failed or something
    if (inviteError) {
        logger.debug(inviteError);
        return SafeReply(intr, GenericError());
    }

    const collector = message!.createMessageComponentCollector({
        componentType: "BUTTON", // only accept button events
        max: 1, // makes the collector terminate after the first button is clicked.
        time: inviteDuration, // invite_duration from minutes to ms
    });

    collector.on("end", async (col, rsn) => {
        await HandleCollectorTimeout(col, rsn, invite, message);
    });
    collector.on("collect", async (buttonIntr) => {
        let res;
        if (buttonIntr.customId.startsWith("accept")) {
            res = await HandleOfferAccept(buttonIntr, intr.guild!, invite);
        } else {
            res = await HandleOfferDecline(buttonIntr, invite);
        }

        if (!res) {
            buttonIntr.deferUpdate();
        }
    });

    // invite success
    return SafeReply(
        intr,
        EmbedToMessage(
            ResponseEmbed()
                .setTitle(":white_check_mark: Invite Sent")
                .setDescription(
                    `${
                        intr.guild!.members.cache.get(invitee.id)!.displayName
                    } has been invited.`
                )
        )
    );
};

const HandleOfferAccept = async (
    intr: MessageComponentInteraction<CacheType>,
    guild: Guild,
    invite: InviteType
) => {
    const team = await FindOne<TeamType>(teamCollection, {invites: invite});

    if (!team) {
        return "Team not found";
    } else if (team.members.includes(intr.user.id) && !Config.dev_mode) {
        return "Members cannot join teams they're already a part of";
    } else if (team.members.length >= Config.teams.max_team_size) {
        return "Team is full";
    }

    const newTeam = {...team};
    newTeam.members.push(intr.user.id);
    newTeam.invites = Remove(newTeam.invites, invite);

    const teamText = guild.channels.cache.get(team.textChannel) as CategoryChannel;
    const teamVoice = guild.channels.cache.get(team.voiceChannel) as CategoryChannel;

    if (!teamText || !teamVoice) {
        return "Couldn't find team channel(s)";
    }

    const oldTextPerms = teamText.permissionOverwrites.valueOf();
    const oldVoicePerms = teamVoice.permissionOverwrites.valueOf();

    const joinError = await WithTransaction(
        async (session) => {
            const newPerms = BuildTeamPermissions(guild, newTeam.members);
            await Promise.allSettled([
                teamText.permissionOverwrites.set(newPerms),
                teamVoice.permissionOverwrites.set(newPerms),
            ]);

            const update = await FindAndUpdate(
                teamCollection,
                {invites: invite},
                {
                    $push: {members: invite.invitee},
                    $pull: {invites: invite},
                } as unknown as PushOperator<MongoDocument>,
                {session}
            );
            if (!update) {
                return "Failed to update team";
            }

            const msg = intr.message as Message<boolean>;
            await msg.edit({
                ...SuccessResponse(
                    `You joined ${invite.teamName} ${Timestamp(Date.now())}.`
                ),
                components: [],
            });

            return "";
        },
        async (err) => {
            logger.error(`Failed to join ${invite.teamName}: ${err}`);
            await Promise.allSettled([
                teamText.permissionOverwrites.set(oldTextPerms),
                teamVoice.permissionOverwrites.set(oldVoicePerms),
            ]);
        }
    );

    if (joinError) {
        await (intr.message as Message<boolean>).edit({
            embeds: [
                ResponseEmbed()
                    .setTitle(":x: Operation Failed")
                    .setDescription(
                        "Something unexpected happened while trying to accept this invite.\
                         The team may be full. Please ask for a new invite."
                    ),
            ],
            components: [],
        });

        return joinError;
    }
    return "";
};

const HandleOfferDecline = async (
    intr: MessageComponentInteraction<CacheType>,
    invite: InviteType
) => {
    const declineError = await WithTransaction(async (session) => {
        if (
            !(await FindAndUpdate(
                teamCollection,
                {invites: invite},
                {$pull: {invites: invite} as unknown as PullOperator<Document>},
                {session}
            ))
        ) {
            return "Failed to remove invite from team";
        }

        const msg = intr.message as Message<boolean>;
        try {
            msg.edit({
                embeds: [
                    ResponseEmbed()
                        .setTitle("Invite Declined")
                        .setDescription(
                            `You declined to join ${invite.teamName} ${Timestamp(
                                Date.now()
                            )}.`
                        ),
                ],
                components: [],
            });
        } catch (_) {
            return "Failed replace invite with declined status";
        }

        return "";
    });

    if (declineError) {
        SafeReply(intr, GenericError());
        return declineError;
    } else {
        intr.deferUpdate();
        return "";
    }
};

const HandleCollectorTimeout = async (
    _: Collection<string, ButtonInteraction<CacheType>>,
    reason: string,
    invite: InviteType,
    message: Message<boolean>
) => {
    if (reason !== "time") {
        return;
    }

    try {
        await FindAndUpdate(
            teamCollection,
            {invites: invite},
            {$pull: {invites: invite} as unknown as PullOperator<Document>}
        );
    } catch (err) {
        logger.error(`Failed to remove invite on expiration: ${err}`);
    }

    message.edit({
        components: [],
        embeds: [
            ResponseEmbed()
                .setTitle(":confused: Invite Expired")
                .setDescription(
                    `This invite to join ${invite.teamName} expired ${Timestamp(
                        Date.now()
                    )}. You'll need to ask for a new invite.`
                ),
        ],
    });
};
