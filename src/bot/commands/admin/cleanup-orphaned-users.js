import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { runCleanup } from '../../utils/cleanup-orphaned-users.js';

export const data = new SlashCommandBuilder()
  .setName('cleanup-orphaned-users')
  .setDescription('Remove users who have left the server from the events database')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addBooleanOption(option =>
    option
      .setName('dry-run')
      .setDescription('Show what would be removed without actually removing anything')
      .setRequired(false)
  );

export async function execute(interaction) {
  // Check if user has admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return await interaction.reply({
      content: 'You need Administrator permissions to run this command.',
      ephemeral: true,
    });
  }

  const dryRun = interaction.options.getBoolean('dry-run') ?? false;
  
  await interaction.reply({
    content: `Starting orphaned user cleanup${dryRun ? ' (DRY RUN - no changes will be made)' : ''}...`,
    ephemeral: false,
  });

  try {
    // Import the cleanup function and run it
    const result = await runCleanup(interaction.client, dryRun);
    
    if (result.success) {
      // Create the main summary embed
      const summaryEmbed = new EmbedBuilder()
        .setColor(dryRun ? 0xf39c12 : 0x2ecc71)
        .setTitle('🗑️ Orphaned User Cleanup Complete')
        .setDescription(dryRun ? 'This was a **dry run** - no changes were made' : 'Cleanup completed successfully')
        .addFields(
          {
            name: '✅ Valid Users',
            value: `${result.validUsersCount} users still in server`,
            inline: true
          },
          {
            name: '🗑️ Orphaned Users',
            value: `${result.orphanedUsers.length} users found`,
            inline: true
          },
          {
            name: dryRun ? '📋 Records to Remove' : '🗑️ Records Removed',
            value: `${result.removedCount} total records`,
            inline: true
          }
        )
        .setTimestamp()
        .setFooter({ text: `Requested by ${interaction.user.tag}` });

      if (result.orphanedUsers.length === 0) {
        summaryEmbed.setDescription('🎉 **No orphaned users found!** Database is clean.');
        await interaction.editReply({
          content: null,
          embeds: [summaryEmbed]
        });
        return;
      }

      // Create paginated embeds for orphaned users
      const usersPerPage = 15;
      const totalPages = Math.ceil(result.orphanedUsers.length / usersPerPage);
      const embeds = [];

      for (let page = 0; page < totalPages; page++) {
        const startIndex = page * usersPerPage;
        const endIndex = startIndex + usersPerPage;
        const pageUsers = result.orphanedUsers.slice(startIndex, endIndex);

        const userEmbed = new EmbedBuilder()
          .setColor(dryRun ? 0xf39c12 : 0xe74c3c)
          .setTitle(`🗑️ Orphaned Users - Page ${page + 1}/${totalPages}`)
          .setDescription(dryRun ? 'These users would be removed:' : 'These users were removed:')
          .addFields(
            {
              name: 'Users',
              value: pageUsers.map(userId => `• <@${userId}> (${userId})`).join('\n'),
              inline: false
            }
          )
          .setTimestamp()
          .setFooter({ text: `Page ${page + 1} of ${totalPages} • Requested by ${interaction.user.tag}` });

        embeds.push(userEmbed);
      }

      // Handle dry-run vs live mode
      if (dryRun) {
        // For dry-run, show results immediately with pagination
        let currentPage = 0;
        let row = null;

        if (totalPages > 1) {
          row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('first')
                .setLabel('⏮️ First')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
              new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
              new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === totalPages - 1),
              new ButtonBuilder()
                .setCustomId('last')
                .setLabel('Last ⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages - 1)
            );
        }

        const response = {
          content: null,
          embeds: [summaryEmbed, embeds[currentPage]]
        };

        if (row) {
          response.components = [row];
        }

        const message = await interaction.editReply(response);

        // Set up button collector if there are multiple pages
        if (totalPages > 1) {
          const collector = message.createMessageComponentCollector({
            time: 300000 // 5 minutes
          });

          collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
              await i.reply({ content: 'This is not your command!', ephemeral: true });
              return;
            }

            switch (i.customId) {
              case 'first':
                currentPage = 0;
                break;
              case 'prev':
                currentPage = Math.max(0, currentPage - 1);
                break;
              case 'next':
                currentPage = Math.min(totalPages - 1, currentPage + 1);
                break;
              case 'last':
                currentPage = totalPages - 1;
                break;
            }

            // Update button states
            const updatedRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('first')
                  .setLabel('⏮️ First')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(currentPage === 0),
                new ButtonBuilder()
                  .setCustomId('prev')
                  .setLabel('◀️ Previous')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(currentPage === 0),
                new ButtonBuilder()
                  .setCustomId('next')
                  .setLabel('Next ▶️')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(currentPage === totalPages - 1),
                new ButtonBuilder()
                  .setCustomId('last')
                  .setLabel('Last ⏭️')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(currentPage === totalPages - 1)
              );

            await i.update({
              embeds: [summaryEmbed, embeds[currentPage]],
              components: [updatedRow]
            });
          });

          collector.on('end', () => {
            // Disable all buttons when collector expires
            const disabledRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('first')
                  .setLabel('⏮️ First')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId('prev')
                  .setLabel('◀️ Previous')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId('next')
                  .setLabel('Next ▶️')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(true),
                new ButtonBuilder()
                  .setCustomId('last')
                  .setLabel('Last ⏭️')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(true)
              );

            message.edit({ components: [disabledRow] }).catch(() => {});
          });
        }
      } else {
        // For live mode, show confirmation first
        const confirmEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('⚠️ Confirm Cleanup')
          .setDescription(`**WARNING:** This will permanently remove ${result.orphanedUsers.length} users and ${result.removedCount} records from the database!\n\nThis action **cannot be undone**.\n\nPlease review the users below and confirm if you want to proceed.`)
          .addFields(
            {
              name: '📊 Summary',
              value: `• ${result.orphanedUsers.length} orphaned users found\n• ${result.removedCount} total records to remove\n• ${result.validUsersCount} valid users will remain`,
              inline: false
            }
          )
          .setTimestamp()
          .setFooter({ text: `Requested by ${interaction.user.tag}` });

        const confirmRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('confirm')
              .setLabel('✅ Confirm Cleanup')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('cancel')
              .setLabel('❌ Cancel')
              .setStyle(ButtonStyle.Secondary)
          );

        // Add pagination buttons if needed
        let paginationRow = null;
        if (totalPages > 1) {
          paginationRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('first')
                .setLabel('⏮️ First')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId('last')
                .setLabel('Last ⏭️')
                .setStyle(ButtonStyle.Secondary)
            );
        }

        const components = [confirmRow];
        if (paginationRow) {
          components.push(paginationRow);
        }

        const message = await interaction.editReply({
          content: null,
          embeds: [confirmEmbed, embeds[0]],
          components
        });

        // Set up button collector for confirmation and pagination
        const collector = message.createMessageComponentCollector({
          time: 300000 // 5 minutes
        });

        let currentPage = 0;

        collector.on('collect', async (i) => {
          if (i.user.id !== interaction.user.id) {
            await i.reply({ content: 'This is not your command!', ephemeral: true });
            return;
          }

          switch (i.customId) {
            case 'confirm':
              // Perform the actual cleanup
              await i.update({
                content: '🔄 Performing cleanup...',
                embeds: [],
                components: []
              });

              try {
                const cleanupResult = await runCleanup(interaction.client, false);
                
                if (cleanupResult.success) {
                  const successEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
                    .setTitle('✅ Cleanup Completed')
                    .setDescription(`Successfully removed ${cleanupResult.orphanedUsers.length} users and ${cleanupResult.removedCount} records from the database.`)
                    .addFields(
                      {
                        name: '📊 Results',
                        value: `• ${cleanupResult.orphanedUsers.length} users removed\n• ${cleanupResult.removedCount} records deleted\n• ${cleanupResult.validUsersCount} valid users remain`,
                        inline: false
                      }
                    )
                    .setTimestamp()
                    .setFooter({ text: `Completed by ${interaction.user.tag}` });

                  await interaction.editReply({
                    content: null,
                    embeds: [successEmbed]
                  });
                } else {
                  const errorEmbed = new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('❌ Cleanup Failed')
                    .setDescription(`An error occurred during cleanup:\n\`\`\`${cleanupResult.error}\`\`\``)
                    .setTimestamp()
                    .setFooter({ text: `Requested by ${interaction.user.tag}` });

                  await interaction.editReply({
                    content: null,
                    embeds: [errorEmbed]
                  });
                }
              } catch (error) {
                const errorEmbed = new EmbedBuilder()
                  .setColor(0xe74c3c)
                  .setTitle('❌ Cleanup Failed')
                  .setDescription(`An unexpected error occurred:\n\`\`\`${error.message}\`\`\``)
                  .setTimestamp()
                  .setFooter({ text: `Requested by ${interaction.user.tag}` });

                await interaction.editReply({
                  content: null,
                  embeds: [errorEmbed]
                });
              }
              break;

            case 'cancel':
              const cancelEmbed = new EmbedBuilder()
                .setColor(0x95a5a6)
                .setTitle('❌ Cleanup Cancelled')
                .setDescription('The cleanup operation was cancelled. No changes were made to the database.')
                .setTimestamp()
                .setFooter({ text: `Cancelled by ${interaction.user.tag}` });

              await i.update({
                content: null,
                embeds: [cancelEmbed],
                components: []
              });
              break;

            case 'first':
              currentPage = 0;
              break;
            case 'prev':
              currentPage = Math.max(0, currentPage - 1);
              break;
            case 'next':
              currentPage = Math.min(totalPages - 1, currentPage + 1);
              break;
            case 'last':
              currentPage = totalPages - 1;
              break;
          }

          // Update pagination buttons if they exist
          if (['first', 'prev', 'next', 'last'].includes(i.customId)) {
            const updatedPaginationRow = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId('first')
                  .setLabel('⏮️ First')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(currentPage === 0),
                new ButtonBuilder()
                  .setCustomId('prev')
                  .setLabel('◀️ Previous')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(currentPage === 0),
                new ButtonBuilder()
                  .setCustomId('next')
                  .setLabel('Next ▶️')
                  .setStyle(ButtonStyle.Primary)
                  .setDisabled(currentPage === totalPages - 1),
                new ButtonBuilder()
                  .setCustomId('last')
                  .setLabel('Last ⏭️')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(currentPage === totalPages - 1)
              );

            const components = [confirmRow];
            if (totalPages > 1) {
              components.push(updatedPaginationRow);
            }

            await i.update({
              embeds: [confirmEmbed, embeds[currentPage]],
              components
            });
          }
        });

        collector.on('end', () => {
          // Disable all buttons when collector expires
          const disabledConfirmRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('confirm')
                .setLabel('✅ Confirm Cleanup')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('❌ Cancel')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            );

          const disabledPaginationRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId('first')
                .setLabel('⏮️ First')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('◀️ Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next ▶️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
              new ButtonBuilder()
                .setCustomId('last')
                .setLabel('Last ⏭️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            );

          const components = [disabledConfirmRow];
          if (totalPages > 1) {
            components.push(disabledPaginationRow);
          }

          message.edit({ components }).catch(() => {});
        });
      }

    } else {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('❌ Cleanup Failed')
        .setDescription(`An error occurred during the cleanup process:\n\`\`\`${result.error}\`\`\``)
        .setTimestamp()
        .setFooter({ text: `Requested by ${interaction.user.tag}` });

      await interaction.editReply({
        content: null,
        embeds: [errorEmbed]
      });
    }
  } catch (error) {
    console.error('Error running cleanup command:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('❌ Unexpected Error')
      .setDescription(`An unexpected error occurred:\n\`\`\`${error.message}\`\`\``)
      .setTimestamp()
      .setFooter({ text: `Requested by ${interaction.user.tag}` });

    await interaction.editReply({
      content: null,
      embeds: [errorEmbed]
    });
  }
}
