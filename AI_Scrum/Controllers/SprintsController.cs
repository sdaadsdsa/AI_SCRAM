using AI_Scrum.Data;
using AI_Scrum.Models;
using AI_Scrum.Services; // Обязательно для GigaChatService
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AI_Scrum.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SprintsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly GigaChatService _aiService;

    // ЕДИНСТВЕННЫЙ правильный конструктор
    public SprintsController(AppDbContext context, GigaChatService aiService)
    {
        _context = context;
        _aiService = aiService;
    }

    public record CreateSprintDto(long TeamId, string Name, string Start, string End);

    // GET: api/sprints/team/{teamId}
    [HttpGet("team/{teamId}")]
    public async Task<IActionResult> GetTeamSprints(long teamId)
    {
        try
        {
            var sprints = await _context.Sprints
                .Where(s => s.TeamId == teamId)
                .OrderBy(s => s.Number)
                .Select(s => new {
                    id = s.Id,
                    teamId = s.TeamId,
                    name = s.Name,
                    start = s.StartDate.ToString("yyyy-MM-dd"),
                    end = s.EndDate.ToString("yyyy-MM-dd"),
                    status = s.Status
                })
                .ToListAsync();

            return Ok(sprints);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Ошибка загрузки спринтов: " + ex.Message });
        }
    }

    // POST: api/sprints
    [HttpPost]
    public async Task<IActionResult> CreateSprint([FromBody] CreateSprintDto request)
    {
        try
        {
            var count = await _context.Sprints.CountAsync(s => s.TeamId == request.TeamId);

            var sprint = new Sprint
            {
                TeamId = request.TeamId,
                Number = count + 1,
                Name = request.Name,
                StartDate = DateOnly.Parse(request.Start),
                EndDate = DateOnly.Parse(request.End),
                Status = "норм"
            };

            _context.Sprints.Add(sprint);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                id = sprint.Id,
                name = sprint.Name,
                start = sprint.StartDate.ToString("yyyy-MM-dd"),
                end = sprint.EndDate.ToString("yyyy-MM-dd"),
                teamId = sprint.TeamId
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Ошибка создания спринта: " + ex.Message });
        }
    }

    // POST: api/sprints/{id}/report
    [HttpPost("{id}/report")]
    public async Task<IActionResult> GenerateReport(long id)
    {
        var sprint = await _context.Sprints
            .Include(s => s.Tasks)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (sprint == null) return NotFound();

        var totalTasks = sprint.Tasks.Count;
        var doneTasks = sprint.Tasks.Count(t => t.Status == "done");

        var taskDetails = string.Join("\n", sprint.Tasks.Select(t =>
            $"- {t.Title} (Статус: {t.Status}, Исполнитель: {(t.AssigneeId != null ? "назначен" : "нет")})"));

        var prompt = $@"Ты — опытный Scrum-мастер. Проанализируй результаты спринта и напиши краткий отчет (3-4 предложения) на русском языке.
Спринт: {sprint.Name}
Период: {sprint.StartDate} - {sprint.EndDate}
Всего задач: {totalTasks}, Выполнено: {doneTasks}.
Список задач:
{taskDetails}

Сделай вывод: успевает ли команда, есть ли риски? Верни только текст отчета, без лишних пояснений и без обертки в JSON.";

        try
        {
            var reportText = await _aiService.CompleteAsync(prompt);
            return Ok(new { report = reportText });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Ошибка ИИ: " + ex.Message });
        }
    }
}