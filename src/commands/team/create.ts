import {CommandInteraction, CacheType} from "discord.js";
import {Config} from "../../config";
import {safeReply, SimpleTextResponse} from "../../helpers/responses";
import {checkTeamAvailability, putTeam} from "../../helpers/teams";
import {createErr, makeTeamChannels, teamNameErr, validateTeamName} from "../team";

export const createTeam = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    if (!intr.guild)
        return safeReply(
            intr,
            SimpleTextResponse(
                ":x: Invalid command usage",
                "This command must be used inside a guild."
            )
        );

    const teamName = intr.options.getString("name")!.trim();
    const discordified = teamName.toLowerCase().replaceAll(" ", "-");

    // TODO: add some name examples
    const validName = validateTeamName(discordified);
    switch (validName) {
        case "TOO_LONG":
            return safeReply(
                intr,
                SimpleTextResponse(
                    teamNameErr,
                    `Provided name is too long. Names must be at most ${Config.teams.max_name_length} characters.`
                )
            );
        case "INVALID_CHARS":
            return safeReply(
                intr,
                SimpleTextResponse(
                    teamNameErr,
                    "Only spaces, hyphens, and English alphanumeric characters are allowed."
                )
            );
        case "REPEATED_CHARS":
            return safeReply(
                intr,
                SimpleTextResponse(
                    teamNameErr,
                    "Each hyphen must have English alphanumeric characters immediately adjacent on both sides."
                )
            );
    }

    // teamName is a valid name, check that a team does not already exist/user is not already in a team
    const [oldTeam, availability] = await checkTeamAvailability(teamName, intr.user.id);
    switch (availability) {
        case "ALREADY_IN_TEAM":
            return safeReply(
                intr,
                SimpleTextResponse(
                    createErr,
                    "Looks like you're already in a team. If you want to create your own team, leave your current team first with `/team leave`."
                )
            );
        case "OWNER_EXISTS":
            const extra =
                oldTeam?.name !== teamName ? "You can rename your team with `/team rename`." : "";

            return safeReply(
                intr,
                SimpleTextResponse(createErr, `It appears you already own a team. ${extra}`)
            );
        case "NAME_EXISTS":
            return safeReply(
                intr,
                SimpleTextResponse(
                    createErr,
                    "That team name already exists. Team names must be unique."
                )
            );
    }

    const [text, voice] = await makeTeamChannels(intr.guild, discordified, [intr.user.id]);
    const putResult = await putTeam(teamName, intr.user.id, text, voice);

    if (!putResult)
        return safeReply(
            intr,
            SimpleTextResponse(
                ":x: Failed to create team",
                "Something went wrong while creating your team."
            )
        );

    return safeReply(
        intr,
        SimpleTextResponse(
            "Success :partying_face:",
            `Team ${teamName} has been created. Your channels are <#${text}> and <#${voice}>. Invite up to 3 others with \`/team invite\`.`
        )
    );
};
