using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AI_Scrum.Models;

public class Team
{
    public long Id { get; set; }

    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty; // Описание проекта/ТЗ

    public DateOnly Deadline { get; set; }
    public TimeOnly DailyTime { get; set; } = new TimeOnly(20, 0); // По умолчанию 20:00

    public long OwnerId { get; set; }
    public User Owner { get; set; } = null!;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Навигационные свойства
    public ICollection<Role> Roles { get; set; } = new List<Role>();
    public ICollection<TeamMember> Members { get; set; } = new List<TeamMember>();
    public ICollection<Sprint> Sprints { get; set; } = new List<Sprint>();
    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
}

public class Role
{
    public long Id { get; set; }
    public long TeamId { get; set; }
    public Team Team { get; set; } = null!;

    [MaxLength(60)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? Description { get; set; }
}

public class TeamMember
{
    public long Id { get; set; }
    public long TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public long UserId { get; set; }
    public User User { get; set; } = null!;

    public long? RoleId { get; set; }
    public Role? Role { get; set; }

    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}