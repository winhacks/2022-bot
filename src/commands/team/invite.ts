import {
    ButtonInteraction,
    CacheType,
    Collection,
    CommandInteraction,
    Guild,
    GuildChannel,
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
    GenericError,
    NotVerifiedResponse,
    ResponseEmbed,
    SafeReply,
} from "../../helpers/responses";
import {TeamType} from "../../types";
import {
    IsUserVerified,
    NotInGuildResponse,
    NotTeamLeaderResponse,
    TeamByOwner,
    TeamFullResponse,
} from "./team-shared";
import {Document as MongoDocument} from "mongodb";
import {Timestamp} from "../../helpers/misc";
import {MessageButtonStyles} from "discord.js/typings/enums";
import {TimestampStyles} from "@discordjs/builders";

// TODO: Create in-memory invite cache
// TODO: Create database storage
// TODO: Expire messages

export const InviteToTeam = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    } else if (!(await IsUserVerified(intr.user.id))) {
        return SafeReply(intr, NotVerifiedResponse());
    }

    const inviteTo = await FindOne<TeamType>(teamCollection, TeamByOwner(intr.user.id));
    if (!inviteTo) {
        return SafeReply(intr, NotTeamLeaderResponse());
    } else if (inviteTo.members.length + 1 >= Config.teams.max_team_size) {
        return SafeReply(intr, TeamFullResponse());
    }

    const invitee = intr.options.getUser("user", true);

    if (!(await IsUserVerified(invitee.id))) {
        return SafeReply(intr, {
            embeds: [
                ResponseEmbed()
                    .setTitle(":x: User Not Verified")
                    .setDescription(
                        "You can only invite verified users to your team. Ask them to verify first with `/verify`."
                    ),
            ],
        });
    } else if (intr.user.id === invitee.id && !Config.dev_mode) {
        return SafeReply(intr, {
            embeds: [
                ResponseEmbed()
                    .setTitle(":confused: You're Already In Your Team")
                    .setDescription(
                        "You tried to invite yourself to your own team. Sadly, cloning hasn't been invented yet."
                    ),
            ],
        });
    }

    let message: Message<boolean>;
    const inviteDuration = Config.teams.invite_duration * 60_000;
    const inviteID = `${Date.now()}#${inviteTo.stdName}`;
    const result = await WithTransaction(async (session) => {
        const inviteAdd = await FindAndUpdate<TeamType>(
            teamCollection,
            inviteTo,
            {
                $push: {invites: inviteID} as unknown as PushOperator<MongoDocument>,
            },
            {session}
        );
        if (!inviteAdd) {
            return "Failed to add invite";
        }

        try {
            const buttonRow = new MessageActionRow().setComponents(
                new MessageButton()
                    .setStyle(MessageButtonStyles.SECONDARY)
                    .setCustomId(`decline#${inviteID}`)
                    .setLabel("Decline"),
                new MessageButton()
                    .setStyle(MessageButtonStyles.PRIMARY)
                    .setCustomId(`accept#${inviteID}`)
                    .setLabel("Accept")
            );
            const inviteMsg = ResponseEmbed()
                .setTitle(":partying_face: You've Been Invited")
                .setDescription(
                    [
                        `You've been invited to join Team ${inviteTo.name}'s noble quest to`,
                        `be the best there ever was at ${Config.bot_info.event_name}.`,
                        `This invite expires ${Timestamp(
                            Date.now() + inviteDuration,
                            TimestampStyles.LongDateTime
                        )}.`,
                    ].join(" ")
                );
            message = await intr.user.send({
                embeds: [inviteMsg],
                components: [buttonRow],
            });
        } catch (err) {
            return `Failed to edit message: ${err}`;
        }

        return "";
    });

    const collector = intr.user.dmChannel!.createMessageComponentCollector({
        componentType: "BUTTON", // only accept button events
        max: 1, // makes the collector terminate after the first button is clicked.
        time: inviteDuration, // invite_duration from minutes to ms
    });

    // message send failed or something
    if (!result) {
        return SafeReply(intr, GenericError());
    }

    // NOTE: invitee.dmChannel?.awaitMessageComponent() is a thing. Look into it

    collector.on("end", async (col, rsn) => {
        await HandleCollectorTimeout(col, rsn, inviteID);
    });
    collector.on("collect", async (buttonIntr) => {
        if (buttonIntr.customId.startsWith("accept")) {
            await HandleOfferAccept(buttonIntr, intr.guild!);
        } else {
            await HandleOfferDecline(buttonIntr);
        }
    });

    // invite success
    return SafeReply(intr, {
        embeds: [
            ResponseEmbed()
                .setTitle(":white_check_mark: Invite Sent")
                .setDescription(
                    `${
                        intr.guild!.members.cache.get(invitee.id)!.displayName
                    } has been invited.`
                ),
        ],
    });
};

const HandleOfferAccept = async (
    intr: MessageComponentInteraction<CacheType>,
    guild: Guild
) => {
    const inviteID = intr.customId.split("#").slice(1).join("#");

    const res = await WithTransaction(async (session) => {
        const sizeGroup = [];
        for (let i = 0; i < Config.teams.max_team_size - 1; i++) {
            sizeGroup.push({members: {$size: i}});
        }

        // TODO: replace this with a proper find and update. false indicates non-existent team, so that's the error condition
        const team = await FindOne<TeamType>(
            teamCollection,
            {
                invites: inviteID,
                $or: sizeGroup,
            },
            {session}
        );

        if (!team) {
            return "Team not found";
        }

        const updatedTeam = {...team};
        updatedTeam.members.push(intr.user.id);

        if (!(await FindAndUpdate(teamCollection, team, updatedTeam, {session}))) {
            return "Failed to update team";
        }

        // TODO: update permissions
        const vc = guild.channels.cache.get(team.voiceChannel)! as GuildChannel;
        const tc = guild.channels.cache.get(team.textChannel)! as GuildChannel;

        const msg = intr.message as Message<boolean>;
        try {
            msg.edit({
                embeds: [
                    ResponseEmbed()
                        .setTitle("Invite Accepted")
                        .setDescription(
                            `You accepted this invite ${Timestamp(Date.now())}.`
                        ),
                ],
                components: [],
            });
        } catch (err) {
            return `Failed to edit message: ${err}`;
        }

        return "";
    });

    if (!res) {
        SafeReply(intr, {
            embeds: [
                ResponseEmbed()
                    .setTitle(":x: Operation Failed")
                    .setDescription(
                        "Something unexpected happened while trying to accept this invite. The team may be full."
                    ),
            ],
        });
    } else {
        intr.deferUpdate();
    }
};

const HandleOfferDecline = async (intr: MessageComponentInteraction<CacheType>) => {
    const inviteID = intr.customId.split("#").slice(1).join("#");

    const res = await WithTransaction(async (session) => {
        if (
            !(await FindAndUpdate(
                teamCollection,
                {invites: inviteID},
                {
                    // remove invite ID
                    $pull: {invites: inviteID} as unknown as PullOperator<Document>,
                },
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
                            `You declined this invite ${Timestamp(Date.now())}.`
                        ),
                ],
                components: [],
            });
        } catch (_) {
            return "Failed replace invite with declined status";
        }

        return "";
    });

    if (!res) {
        SafeReply(intr, GenericError());
    } else {
        intr.deferUpdate();
    }
};

const HandleMessageExpiration = async (inviteID: string) => {
    await FindAndUpdate(
        teamCollection,
        {invites: inviteID},
        {$pull: {invites: inviteID} as unknown as PullOperator<Document>}
    );
};

const HandleCollectorTimeout = async (
    _: Collection<string, ButtonInteraction<CacheType>>,
    reason: string,
    inviteID: string
) => {
    if (reason === "time") {
        await HandleMessageExpiration(inviteID);
    }
};
