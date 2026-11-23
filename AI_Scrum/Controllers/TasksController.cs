using AI_Scrum.Data;
using AI_Scrum.Models;
using AI_Scrum.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace AI_Scrum.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TasksController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly GigaChatService _aiService;

    // ЕДИНСТВЕННЫЙ правильный конструктор
    public TasksController(AppDbContext context, GigaChatService aiService)
    {
        _context = context;
        _aiService = aiService;
    }

    // DTO для приема данных
    public record CreateTaskDto(long TeamId, string Title, string Desc, string Priority, long? SprintId, long? AssigneeId, string? Due, short? Est);
    public record GenerateRequest(long TeamId, string Description);

    // GET: api/tasks/team/{teamId}
    [HttpGet("team/{teamId}")]
    public async Task<IActionResult> GetTeamTasks(long teamId)
    {
        try
        {
            var tasks = await _context.Tasks
                .Where(t => t.TeamId == teamId)
                .Select(t => new {
                    id = t.Id,
                    teamId = t.TeamId,
                    title = t.Title ?? "Без названия",
                    desc = t.Description ?? "",
                    priority = t.Priority ?? "green",
                    status = t.Status ?? "backlog",
                    assignee = t.AssigneeId,
                    sprintId = t.SprintId,
                    due = t.DueDate != null ? t.DueDate.Value.ToString("yyyy-MM-dd") : null,
                    est = t.EstHours
                })
                .ToListAsync();

            return Ok(tasks);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Ошибка при загрузке задач: " + ex.Message });
        }
    }

    // PUT: api/tasks/{id}/sprint
    [HttpPut("{id}/sprint")]
    public async Task<IActionResult> AssignToSprint(long id, [FromBody] long? sprintId)
    {
        var task = await _context.Tasks.FindAsync(id);
        if (task == null) return NotFound();

        if (sprintId.HasValue)
        {
            var sprintExists = await _context.Sprints.AnyAsync(s => s.Id == sprintId.Value);
            if (!sprintExists) return BadRequest(new { message = "Спринт не найден" });
        }

        task.SprintId = sprintId;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // POST: api/tasks
    [HttpPost]
    public async Task<IActionResult> CreateTask([FromBody] CreateTaskDto request)
    {
        var task = new TaskItem
        {
            TeamId = request.TeamId,
            Title = request.Title,
            Description = request.Desc,
            Priority = request.Priority,
            SprintId = request.SprintId,
            AssigneeId = request.AssigneeId,
            DueDate = request.Due != null ? DateOnly.Parse(request.Due) : null,
            EstHours = request.Est,
            Status = "backlog"
        };

        _context.Tasks.Add(task);
        await _context.SaveChangesAsync();

        return Ok(new { id = task.Id, message = "Задача создана" });
    }

    public record StatusDto(string Status);

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(long id, [FromBody] StatusDto request)
    {
        var task = await _context.Tasks.FindAsync(id);
        if (task == null) return NotFound();

        task.Status = request.Status;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // PUT: api/tasks/{id}/assignee
    [HttpPut("{id}/assignee")]
    public async Task<IActionResult> Reassign(long id, [FromBody] long? assigneeId)
    {
        var task = await _context.Tasks.FindAsync(id);
        if (task == null) return NotFound();

        task.AssigneeId = assigneeId;
        await _context.SaveChangesAsync();
        return Ok();
    }

    // PUT: api/tasks/{id}/edit
    [HttpPut("{id}/edit")]
    public async Task<IActionResult> EditTask(long id, [FromBody] CreateTaskDto request)
    {
        var task = await _context.Tasks.FindAsync(id);
        if (task == null) return NotFound();

        task.Title = request.Title;
        task.Description = request.Desc;
        task.Priority = request.Priority;
        task.EstHours = request.Est;
        task.DueDate = request.Due != null ? DateOnly.Parse(request.Due) : null;
        task.AssigneeId = request.AssigneeId;

        await _context.SaveChangesAsync();
        return Ok();
    }
    // GET: api/teams/{teamId}/members
    [HttpGet("{teamId}/members")]
    public async Task<IActionResult> GetTeamMembers(long teamId)
    {
        var members = await _context.TeamMembers
            .Where(m => m.TeamId == teamId)
            .Include(m => m.User)
            .ThenInclude(u => u.Skills)
            .Include(m => m.Role) // Подгружаем роль
            .Select(m => new {
                id = m.User.Id,
                login = m.User.Login,
                name = m.User.FirstName ?? m.User.Login,
                role = m.Role != null ? m.Role.Name : "Участник", // Берем название роли из базы
                skills = m.User.Skills.Select(s => s.Skill).ToList()
            })
            .ToListAsync();

        return Ok(members);
    }

    // PUT: api/teams/{teamId}/members/{userId}/role
    [HttpPut("{teamId}/members/{userId}/role")]
    public async Task<IActionResult> UpdateRole(long teamId, long userId, [FromBody] string roleName)
    {
        var member = await _context.TeamMembers
            .FirstOrDefaultAsync(m => m.TeamId == teamId && m.UserId == userId);

        if (member == null) return NotFound();

        // Ищем роль в таблице Roles по имени. Если нет — создаем новую.
        var role = await _context.Roles.FirstOrDefaultAsync(r => r.TeamId == teamId && r.Name == roleName);
        if (role == null)
        {
            role = new Role { TeamId = teamId, Name = roleName };
            _context.Roles.Add(role);
            await _context.SaveChangesAsync();
        }

        member.RoleId = role.Id;
        await _context.SaveChangesAsync();

        return Ok();
    }
    // DELETE: api/tasks/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTask(long id)
    {
        var task = await _context.Tasks.FindAsync(id);
        if (task == null) return NotFound();

        _context.Tasks.Remove(task);
        await _context.SaveChangesAsync();
        return Ok();
    }
    // POST: api/tasks/distribute
    [HttpPost("distribute")]
    public async Task<IActionResult> DistributeTasks([FromBody] long teamId)
    {
        // 1. Получаем задачи, которые еще не выполнены
        var tasks = await _context.Tasks
            .Where(t => t.TeamId == teamId && t.Status != "done")
            .ToListAsync();

        if (!tasks.Any()) return BadRequest(new { message = "Нет активных задач для распределения" });

        // 2. Получаем участников и их навыки
        var members = await _context.TeamMembers
            .Where(m => m.TeamId == teamId)
            .Include(m => m.User)
            .ThenInclude(u => u.Skills)
            .Select(m => new {
                Id = m.UserId,
                Name = m.User.FirstName ?? m.User.Login,
                Skills = m.User.Skills.Select(s => s.Skill).ToList()
            })
            .ToListAsync();

        if (!members.Any()) return BadRequest(new { message = "В команде нет участников" });

        // 3. Формируем промпт для ИИ
        var tasksText = string.Join("\n", tasks.Select(t => $"- ID: {t.Id}, Задача: {t.Title}"));
        var membersText = string.Join("\n", members.Select(m => $"- ID: {m.Id}, Имя: {m.Name}, Навыки: {string.Join(", ", m.Skills)}"));

        var prompt = $@"Ты — Scrum-мастер. Распредели задачи между участниками команды на основе их навыков.
Задачи:
{tasksText}

Участники:
{membersText}

Верни ответ строго в виде JSON-массива, где каждый объект имеет поля: 'taskId' (число) и 'assigneeId' (число). Не пиши ничего кроме JSON.";

        try
        {
            var aiResponse = await _aiService.CompleteAsync(prompt);
            aiResponse = aiResponse.Replace("```json", "").Replace("```", "").Trim();

            using var doc = JsonDocument.Parse(aiResponse);
            var assignments = doc.RootElement.EnumerateArray();
            var assignedCount = 0;

            foreach (var item in assignments)
            {
                var taskId = item.GetProperty("taskId").GetInt64();
                var assigneeId = item.GetProperty("assigneeId").GetInt64();

                var task = tasks.FirstOrDefault(t => t.Id == taskId);
                if (task != null)
                {
                    task.AssigneeId = assigneeId;
                    assignedCount++;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"ИИ распределил {assignedCount} задач" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Ошибка ИИ при распределении: " + ex.Message });
        }
    }
    // POST: api/tasks/generate
    [HttpPost("generate")]
    public async Task<IActionResult> GenerateTasks([FromBody] GenerateRequest request)
    {
        var team = await _context.Teams.FindAsync(request.TeamId);
        if (team == null) return NotFound(new { message = "Команда не найдена" });

        var prompt = $@"Ты — опытный проект-менеджер. На основе описания проекта составь список задач для команды разработчиков.
Описание проекта: '{request.Description}'

Сгенерируй ровно 5 задач, покрывающих основные этапы разработки (анализ, дизайн, бэкенд, фронтенд, тестирование).
Верни ответ строго в виде JSON-массива, где каждый объект имеет поля: 'title' (строка), 'description' (строка), 'priority' (строка: 'red', 'orange' или 'green'), 'est_hours' (число).
Не пиши ничего кроме JSON.";

        try
        {
            var aiResponse = await _aiService.CompleteAsync(prompt);

            // Очищаем ответ от возможных маркеров кода и лишних пробелов
            aiResponse = aiResponse.Replace("```json", "").Replace("```", "").Trim();

            // Находим первую квадратную скобку и последнюю (на случай, если ИИ написал текст до/после)
            int startIdx = aiResponse.IndexOf('[');
            int endIdx = aiResponse.LastIndexOf(']');
            if (startIdx >= 0 && endIdx > startIdx)
            {
                aiResponse = aiResponse.Substring(startIdx, endIdx - startIdx + 1);
            }
            else
            {
                throw new Exception("ИИ не вернул JSON-массив. Ответ: " + aiResponse);
            }

            using var doc = JsonDocument.Parse(aiResponse);
            var tasksList = doc.RootElement.EnumerateArray();
            var createdCount = 0;

            foreach (var item in tasksList)
            {
                var task = new TaskItem
                {
                    TeamId = request.TeamId,
                    Title = item.GetProperty("title").GetString() ?? "Без названия",
                    Description = item.GetProperty("description").GetString() ?? "",
                    Priority = item.GetProperty("priority").GetString() ?? "green",
                    EstHours = (short)item.GetProperty("est_hours").GetInt32(),
                    Status = "backlog",
                    AiCreated = true,
                    DueDate = team.Deadline
                };
                _context.Tasks.Add(task);
                createdCount++;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"ИИ успешно создал {createdCount} задач" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "Ошибка ИИ: " + ex.Message });
        }
    }
}