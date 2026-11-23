using AI_Scrum.Data;
using AI_Scrum.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AI_Scrum.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TeamsController : ControllerBase
{
    private readonly AppDbContext _context;
    public TeamsController(AppDbContext context) => _context = context;

    // DTO для приема данных с фронтенда
    public record CreateTeamDto(string Name, string Desc, string Deadline, string OwnerLogin);
    public record TeamResponse(long Id, string Name, string Desc, string Deadline, string Owner, string Emoji);

    // POST: api/teams
    [HttpPost]
    public async Task<IActionResult> CreateTeam([FromBody] CreateTeamDto request)
    {
        var owner = await _context.Users.FirstOrDefaultAsync(u => u.Login == request.OwnerLogin);
        if (owner == null) return BadRequest(new { message = "Пользователь не найден" });

        var team = new Team
        {
            Name = request.Name,
            Description = request.Desc,
            Deadline = DateOnly.Parse(request.Deadline),
            OwnerId = owner.Id
        };

        _context.Teams.Add(team);
        await _context.SaveChangesAsync();

        return Ok(new TeamResponse(
            team.Id,
            team.Name,
            team.Description,
            team.Deadline.ToString("yyyy-MM-dd"),
            owner.Login,
            "S"
        ));
    }

    // GET: api/teams/by-login/{login}
    [HttpGet("by-login/{login}")]
    public async Task<IActionResult> GetUserTeams(string login)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Login == login);
        if (user == null) return NotFound();

        var teams = await _context.Teams
            .Where(t => t.OwnerId == user.Id || _context.TeamMembers.Any(tm => tm.TeamId == t.Id && tm.UserId == user.Id))
            .Select(t => new TeamResponse(
                t.Id, t.Name, t.Description, t.Deadline.ToString("yyyy-MM-dd"), t.Owner.Login, "S"
            ))
            .ToListAsync();

        return Ok(teams);
    }

    // POST: api/teams/{teamId}/members
    [HttpPost("{teamId}/members")]
    public async Task<IActionResult> AddMember(long teamId, [FromBody] string login)
    {
        var team = await _context.Teams.FindAsync(teamId);
        if (team == null) return NotFound(new { message = "Команда не найдена" });

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Login == login.Trim().ToLower());
        if (user == null) return NotFound(new { message = "Пользователь с таким логином не найден" });

        var exists = await _context.TeamMembers.AnyAsync(m => m.TeamId == teamId && m.UserId == user.Id);
        if (exists) return BadRequest(new { message = "Этот пользователь уже в команде" });

        var member = new TeamMember
        {
            TeamId = teamId,
            UserId = user.Id
        };

        _context.TeamMembers.Add(member);
        await _context.SaveChangesAsync();

        return Ok(new { id = user.Id, login = user.Login, name = user.FirstName });
    }

    // GET: api/teams/{teamId}/members
    [HttpGet("{teamId}/members")]
    public async Task<IActionResult> GetTeamMembers(long teamId)
    {
        var members = await _context.TeamMembers
            .Where(m => m.TeamId == teamId)
            .Include(m => m.User)
            .ThenInclude(u => u.Skills)
            .Include(m => m.Role)
            .Select(m => new {
                id = m.User.Id,
                login = m.User.Login,
                name = m.User.FirstName ?? m.User.Login,
                role = m.Role != null ? m.Role.Name : "Участник",
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

        if (member == null) return NotFound(new { message = "Участник не найден" });

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
}