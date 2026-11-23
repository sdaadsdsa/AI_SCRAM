using System.ComponentModel.DataAnnotations;

namespace AI_Scrum.Models;

// Таблица для логов ИИ (как в вашем schema.sql)
public class AiLog
{
    public long Id { get; set; }

    public long? TeamId { get; set; }
    public Team? Team { get; set; }

    [MaxLength(30)]
    public string RequestType { get; set; } = string.Empty;

    [MaxLength(10)]
    public string Provider { get; set; } = "groq";

    public string? Prompt { get; set; }
    public string? Response { get; set; }

    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public int? DurationMs { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

// Таблица для светофора проекта (project_status)
public class ProjectStatus
{
    public long Id { get; set; }

    public long TeamId { get; set; }
    public Team Team { get; set; } = null!;

    [MaxLength(6)]
    public string Color { get; set; } = string.Empty; // green, yellow, red

    public DateTime ComputedAt { get; set; } = DateTime.UtcNow;

    public string Reason { get; set; } = string.Empty;
}