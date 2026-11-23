namespace AI_Scrum.Models;

public class DailyAnswer
{
    public long Id { get; set; }
    public long TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public long UserId { get; set; }
    public User User { get; set; } = null!;

    public DateOnly AnswerDate { get; set; }

    public string DoneText { get; set; } = string.Empty;
    public string PlannedText { get; set; } = string.Empty;
    public string BlockersText { get; set; } = string.Empty;

    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
}

public class AiReport
{
    public long Id { get; set; }
    public long TeamId { get; set; }
    public Team Team { get; set; } = null!;

    public long? SprintId { get; set; }
    public Sprint? Sprint { get; set; }

    // daily_summary или sprint_report
    public string Type { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}