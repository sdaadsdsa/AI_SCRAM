using Microsoft.EntityFrameworkCore;
using AI_Scrum.Models;

namespace AI_Scrum.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
    public DbSet<AiLog> AiLogs { get; set; }
    public DbSet<ProjectStatus> ProjectStatuses { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<UserSkill> UserSkills { get; set; }
    public DbSet<Team> Teams { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<TeamMember> TeamMembers { get; set; }
    public DbSet<Sprint> Sprints { get; set; }
    public DbSet<TaskItem> Tasks { get; set; }
    public DbSet<DailyAnswer> DailyAnswers { get; set; }
    public DbSet<AiReport> AiReports { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Уникальные индексы, как в вашем SQL файле
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Login)
            .IsUnique();

        modelBuilder.Entity<UserSkill>()
            .HasIndex(us => new { us.UserId, us.Skill })
            .IsUnique();

        modelBuilder.Entity<TeamMember>()
            .HasIndex(tm => new { tm.TeamId, tm.UserId })
            .IsUnique();

        modelBuilder.Entity<DailyAnswer>()
            .HasIndex(da => new { da.TeamId, da.UserId, da.AnswerDate })
            .IsUnique();

        // Связь Team.Owner (владелец) - нельзя удалить пользователя, если он владелец
        modelBuilder.Entity<Team>()
            .HasOne(t => t.Owner)
            .WithMany()
            .HasForeignKey(t => t.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<ProjectStatus>()
            .HasIndex(ps => ps.TeamId)
            .IsUnique();
    }
}