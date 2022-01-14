import {hyperlink} from "@discordjs/builders";
import {
    CacheType,
    CommandInteraction,
    DiscordAPIError,
    Message,
    MessageActionRow,
    MessageButton,
    MessageComponentInteraction,
} from "discord.js";
import {MessageButtonStyles} from "discord.js/typings/enums";
import {Config} from "../../config";
import {FindOne, teamCollection} from "../../helpers/database";
import {RelativeTime} from "../../helpers/misc";
import {
    GenericError,
    NotVerifiedResponse,
    ResponseEmbed,
    SafeReply,
} from "../../helpers/responses";
import {TeamType} from "../../types";
import {
    GetInviteId,
    IsUserVerified,
    NotInGuildResponse,
    NotTeamLeaderResponse,
    ParseInviteId,
    TeamByMember,
    TeamByName,
    TeamByOwner,
    TeamFullResponse,
} from "./team-shared";

// TODO: Create in-memory invite cache
// TODO: Create database storage
// TODO: Expire messages

export const InviteToTeam = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    } else if (!(await IsUserVerified(intr.user.id))) {
        return SafeReply(intr, NotVerifiedResponse());
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
    } else if (intr.user.id === invitee.id) {
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
    const userToInvite = intr.guild!.members.cache.find((usr) => usr.id === invitee.id)!;

    const team = await FindOne<TeamType>(teamCollection, TeamByOwner(intr.user.id));
    if (!team) {
        return SafeReply(intr, NotTeamLeaderResponse());
    }

    if (team.members.length + 1 >= Config.teams.max_team_size)
        return SafeReply(intr, TeamFullResponse());

    // try sending the invite to the user's DM
    const inviteEmbed = ResponseEmbed()
        .setTitle(":partying_face: You've Been Invited")
        .setDescription(
            [
                `You've been invited to join Team ${team.name}'s noble quest to`,
                `be the best there ever was at ${Config.bot_info.event_name}.`,
                `This invite expires ${RelativeTime(Date.now())}.`,
            ].join(" ")
        );

    const duration = Config.teams.invite_duration * 60_000;
    const acceptID = GetInviteId(team.stdName, "accept");
    const declineID = GetInviteId(team.stdName, "decline");
    const buttonRow = new MessageActionRow().addComponents(
        new MessageButton()
            .setStyle(MessageButtonStyles.SECONDARY)
            .setLabel("Decline")
            .setCustomId(declineID),
        new MessageButton()
            .setStyle(MessageButtonStyles.PRIMARY)
            .setLabel("Accept")
            .setCustomId(acceptID)
    );

    let message: Message;
    try {
        message = await userToInvite.send({
            embeds: [inviteEmbed],
            components: [buttonRow],
        });
    } catch (err) {
        // if we caught something that isn't an API error, or is not code
        // 50007 (user not accepting DMs), throw generic error
        if (!(err instanceof DiscordAPIError) || err.httpStatus != 403) {
            return SafeReply(intr, GenericError());
        }

        // cannot send DMs to this user, report that failure
        return SafeReply(intr, {
            ephemeral: true,
            embeds: [
                ResponseEmbed()
                    .setTitle(":x: Cannot Invite User")
                    .setDescription(
                        `This user is not allowing DMs from this server. Ask them to temporarily ${hyperlink(
                            "enable them",
                            "https://support.discord.com/hc/en-us/articles/217916488-Blocking-Privacy-Settings-"
                        )}, then try again.`
                    ),
            ],
        });
    }

    if (!invitee.dmChannel) {
        return SafeReply(intr, GenericError());
    }

    const eventFilter = (i: MessageComponentInteraction<"cached">) =>
        i.customId === acceptID || i.customId === declineID;

    const eventCollector = invitee.dmChannel.createMessageComponentCollector({
        filter: eventFilter,
        time: duration,
    });

    eventCollector.on("collect", OnCollectorCollect);
    eventCollector.on("end", () => {
        HandleMessageExpiration(message, team);
    });

    return SafeReply(intr, {
        embeds: [
            ResponseEmbed()
                .setTitle(":white_check_mark: Invite Sent")
                .setDescription(`${userToInvite.displayName} has been invited.`),
        ],
    });
};

const OnCollectorCollect = async (intr: MessageComponentInteraction<CacheType>) => {
    const {action} = ParseInviteId(intr.customId);

    if (action === "accept") {
        await HandleOfferAccept(intr);
    } else {
        await HandleOfferDecline(intr);
    }

    intr.deferUpdate();
};

const HandleOfferAccept = async (intr: MessageComponentInteraction<CacheType>) => {
    const {teamName} = ParseInviteId(intr.customId);
    const existingTeam = await FindOne<TeamType>(
        teamCollection,
        TeamByMember(intr.user.id, true)
    );

    let response;
    if (existingTeam) {
        response = ResponseEmbed()
            .setTitle(":x: You Can't Join Another Team")
            .setDescription(
                [
                    "Sorry, you're only allowed to be in one team at a time.",
                    "You can leave your current team with `/team leave`.",
                ].join(" ")
            );
    } else {
        const team = FindOne<TeamType>(teamCollection, TeamByName(teamName));
        response = ResponseEmbed()
            .setTitle(`:partying_face: You're now a member of Team ${teamName}`)
            .setDescription(`You accepted the invite ${RelativeTime(Date.now())}.`);
    }
    return (intr.message as Message<boolean>).edit({
        embeds: [response],
        components: [],
    });
};

const HandleOfferDecline = async (intr: MessageComponentInteraction<CacheType>) => {
    const {teamName} = ParseInviteId(intr.customId);
    const response = ResponseEmbed()
        .setTitle(":confused: Invite Declined")
        .setDescription(
            `You declined to join Team ${teamName} ${RelativeTime(Date.now())}.`
        );
    return await (intr.message as Message<boolean>).edit({
        embeds: [response],
        components: [],
    });
};

const HandleMessageExpiration = (msg: Message, team: TeamType) => {
    const expired = ResponseEmbed()
        .setTitle(":confused: Invite Expired")
        .setDescription(
            `Your invite to join ${team.name} expired ${RelativeTime(
                Date.now()
            )}. You can ask the team leader for another.`
        );
    msg.edit({embeds: [expired], components: []});
};
