using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AI_Scrum.Models;

public class User
{
    public long Id { get; set; }

    [Required]
    [MaxLength(40)]
    public string Login { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(80)]
    public string? FirstName { get; set; }

    [MaxLength(80)]
    public string? LastName { get; set; }

    [MaxLength(80)]
    public string? Patronymic { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<UserSkill> Skills { get; set; } = new List<UserSkill>();
    public ICollection<TeamMember> TeamMemberships { get; set; } = new List<TeamMember>();
}

public class UserSkill
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public User User { get; set; } = null!;

    [MaxLength(60)]
    public string Skill { get; set; } = string.Empty;
}