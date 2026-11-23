using System.ComponentModel.DataAnnotations;

namespace AI_Scrum.Models;

public class Sprint
{
    public long Id { get; set; }
    public long TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public int Number { get; set; } // Порядковый номер спринта

    [Required]
    [MaxLength(120)]
    public string Name { get; set; } = string.Empty;

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    [MaxLength(10)]
    public string Status { get; set; } = "норм"; // "норм" или "горит"

    public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
}

public class TaskItem
{
    public long Id { get; set; }
    public long TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public long? SprintId { get; set; }
    public Sprint? Sprint { get; set; }

    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    [MaxLength(6)]
    public string Priority { get; set; } = "green"; // red, orange, green

    [MaxLength(12)]
    public string Status { get; set; } = "backlog"; // backlog, in_progress, done

    public long? AssigneeId { get; set; }
    public User? Assignee { get; set; }

    public DateOnly? DueDate { get; set; }

    public short? EstHours { get; set; }

    public bool AiCreated { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}