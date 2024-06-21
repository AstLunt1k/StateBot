const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const curatorModel = require('../../../models/database/curator');
const guildController = require('../../../models/database/controllers/guildController');
const wlModel = require('../../../models/database/whitelist');
const guild_roleModel = require('../../../models/database/guild_role');

module.exports = {
    handleCuratorStatus: async (client, interaction, factionType) => {
        await interaction.deferReply({ ephemeral: true });
        const { user } = interaction;
        const objectId = interaction.message.embeds[0].footer.text;
        const curator = await curatorModel.findById(objectId);
        const guild = await guildController.find({ GuildName: factionType });
        const msg = interaction.message;
        const whitelist = await wlModel.findOne({ User: user.id });
        const guildRole = await guild_roleModel.findOne({ GuildId: guild.GuildId });
        
        if (!curator) {
            return interaction.editReply({ content: 'Упс, такого куратора нет..' });
        }
        
        const channel = await client.channels.fetch(guild.CurNews);
        const guildId = client.guilds.cache.get(guild.GuildId);
        let userTarg;

        try {
            userTarg = await guildId.members.fetch(curator.UserId);
        } catch (err) {
            
        }

        const toggleCuratorStatus = async (isCurator, isAllKick = false) => {
            try {
                const factionKey = factionType.toLowerCase();
                const updateData = isAllKick
                    ? { $set: { lspd: false, ems: false, lssd: false, sang: false, gov: false, wn: false, fib: false } }
                    : { $set: { [factionKey]: isCurator } };
                    
                if (whitelist) {
                    await curatorModel.findOneAndUpdate(
                        { UserId: curator.UserId },
                        updateData
                    );
                }

                const updatedCurator = await curatorModel.findById(objectId);
                const { desc, icons } = getDescAndIcons(updatedCurator);
                const emojis = getEmojis(updatedCurator, icons);
                const text = getDescriptionText(updatedCurator, desc);
                const curatorSelectMenu = createCuratorSelectMenu(text, emojis);
                const curatedFactions = getCuratedFactions(updatedCurator);
                const formattedDate = formatDate(curator.Date);

                const embed1 = new EmbedBuilder()
                    .setThumbnail('https://i.imgur.com/0HSvG9n.gif')
                    .setDescription(`Информация о кураторе: <@${curator.UserId}>`)
                    .addFields(
                        { name: 'NickName:', value: `${curator.Name}`, inline: true },
                        { name: 'Дата становления:', value: `${formattedDate}`, inline: true },
                        { name: 'Курирует фракции:', value: `${curatedFactions}`, inline: false }
                    )
                    .setFooter({ text: `${objectId}`, iconURL: 'https://i.imgur.com/Pe9ldH5.png' })
                    .setTimestamp();

                const curSelect = new ActionRowBuilder().addComponents(curatorSelectMenu);

                await msg.edit({
                    embeds: [embed1],
                    components: [
                        {
                            type: 1,
                            components: [curatorSelectMenu]
                        }
                    ]
                });

                if (!whitelist) {
                    return interaction.editReply({ content: 'Упс, мы столкнулись с проблемой - Вы не имеете к этому доступа.' });
                }

                if (isAllKick) {
                    const userGuilds = client.guilds.cache.filter(guild => guild.members.cache.has(curator.UserId));


                    for (const [guildId, guild] of userGuilds) {
                        

                        try {
                            const member = await guild.members.fetch(curator.UserId);

                            await member.roles.set([]);
                        } catch (err) {
                            console.error(`Ошибка при снятии ролей для пользователя ${curator.UserId} в гильдии ${guild.name}: ${err}`);
                        }
                    }

                    await curatorModel.findByIdAndDelete({ _id: objectId });
                    await interaction.message.delete();

                    return interaction.editReply({
                        content: `<a:astscan:1199035562070380544> Вы успешно лишили: <@${curator.UserId}> всех ролей во всех серверах.`
                    });
                } else if (isCurator) {
                    try {
                        await channel.send({ content: `<@&${guildRole.FirstRole}>\nПривет, у Вас новый Curator: <@${curator.UserId}>` });
                    } catch (error) {
                        console.error(`Возникла ошибка: ${error}. При выполнении: \`${factionType}CurMake\`.`);
                    }

                    if (!userTarg) {
                        return interaction.editReply({
                            content: `<a:astscan:1199035562070380544> Информация о новом кураторе записана и передана фракции, но вот роли я выдать ему не смог т.к. он не зашёл в дискорд, потом выдам при заходе..`
                        });
                    }

                    await userTarg.roles.add(guildRole.CurRole);
                    return interaction.editReply({
                        content: `<a:astscan:1199035562070380544> Вы присвоили: <@${curator.UserId}> статус куратора.`
                    });
                } else {

                    if (!userTarg) {
                        return interaction.editReply({
                            content: `<a:astscan:1199035562070380544> Информация была записана, но роль снять я ему не смог т.к. его нет в дискорде...`
                        });
                    }
                    
                    await userTarg.roles.remove(guildRole.CurRole);
                    await userTarg.roles.remove(guildRole.AdmRole);
                    return interaction.editReply({
                        content: `<a:astscan:1199035562070380544> Вы успешно лишили: <@${curator.UserId}> статуса куратора, роль была снята.`
                    });
                }
            } catch (error) {
                console.error(error);
            }
        };

        const isCurator = curator[factionType.toLowerCase()];
        const isAllKick = interaction.values.includes('akick');
        await toggleCuratorStatus(!isCurator, isAllKick);
    }
};

// Функции для получения описаний, иконок и эмодзи
function getDescAndIcons(curator) {
    const desc = {
        'lspd': { false: 'Назначить куратором структуры', true: 'Лишить статуса куратора структуры' },
        'ems': { false: 'Назначить куратором структуры', true: 'Лишить статуса куратора структуры' },
        'lssd': { false: 'Назначить куратором структуры', true: 'Лишить статуса куратора структуры' },
        'sang': { false: 'Назначить куратором структуры', true: 'Лишить статуса куратора структуры' },
        'gov': { false: 'Назначить куратором структуры', true: 'Лишить статуса куратора структуры' },
        'wn': { false: 'Назначить куратором структуры', true: 'Лишить статуса куратора структуры' },
        'fib': { false: 'Назначить куратором структуры', true: 'Лишить статуса куратора структуры' }
    };

    const icons = {
        'lspd': { false: '<a:astcross_no:1212311277549125662>', true: '<a:astcross_ok:1212311279180582982>' },
        'ems': { false: '<a:astcross_no:1212311277549125662>', true: '<a:astcross_ok:1212311279180582982>' },
        'lssd': { false: '<a:astcross_no:1212311277549125662>', true: '<a:astcross_ok:1212311279180582982>' },
        'sang': { false: '<a:astcross_no:1212311277549125662>', true: '<a:astcross_ok:1212311279180582982>' },
        'gov': { false: '<a:astcross_no:1212311277549125662>', true: '<a:astcross_ok:1212311279180582982>' },
        'wn': { false: '<a:astcross_no:1212311277549125662>', true: '<a:astcross_ok:1212311279180582982>' },
        'fib': { false: '<a:astcross_no:1212311277549125662>', true: '<a:astcross_ok:1212311279180582982>' }
    };

    return { desc, icons };
}

function getEmojis(curator, icons) {
    const emojis = {};
    for (let key in icons) {
        emojis[key] = curator[key] ? icons[key].true : icons[key].false;
    }
    return emojis;
}

function getDescriptionText(curator, desc) {
    const text = {};
    for (let key in desc) {
        text[key] = curator[key] ? desc[key].true : desc[key].false;
    }
    return text;
}

function getCuratedFactions(curator) {
    const factions = {
        lspd: curator.lspd,
        ems: curator.ems,
        lssd: curator.lssd,
        sang: curator.sang,
        gov: curator.gov,
        wn: curator.wn,
        fib: curator.fib,
    };

    const curatedFactions = Object.entries(factions)
        .filter(([_, value]) => value === true)
        .map(([faction]) => faction);

    return curatedFactions.length > 0 ? curatedFactions.join(', ') : 'Нет курируемых фракций';
}

function createCuratorSelectMenu(text, emojis) {
    const curatorSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('curSelectList')
        .setPlaceholder('Select a reason')
        .addOptions([
            {
                label: 'Los Santos Police Department',
                value: 'lspdCur',
                description: text.lspd,
                emoji: emojis.lspd,
            },
            {
                label: 'Emergency Medical Services',
                value: 'emsCur',
                description: text.ems,
                emoji: emojis.ems,
            },
            {
                label: 'Los Santos Sheriff Department',
                value: 'lssdCur',
                description: text.lssd,
                emoji: emojis.lssd,
            },
            {
                label: 'San-Andreas National Guard',
                value: 'sangCur',
                description: text.sang,
                emoji: emojis.sang,
            },
            {
                label: 'Government',
                value: 'govCur',
                description: text.gov,
                emoji: emojis.gov,
            },
            {
                label: 'Weazel News',
                value: 'wnCur',
                description: text.wn,
                emoji: emojis.wn,
            },
            {
                label: 'Federal Investigation Bureau',
                value: 'fibCur',
                description: text.fib,
                emoji: emojis.fib,
            },
            {
                label: 'All kick',
                value: 'akick',
                description: 'Лишить всех кураторок',
                emoji: '<a:astcross_no:1212311277549125662>',
            },
            {
                label: 'Снять выбор',
                value: 'noSelect',
                description: 'Откажитесь от своего выбора',
                emoji: '<a:astcross_no:1212311277549125662>',
                default: true
            },
        ]);

    return curatorSelectMenu;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day}.${month}.${year}`;
}