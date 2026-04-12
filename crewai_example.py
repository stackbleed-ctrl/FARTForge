"""
examples/crewai_example.py

Example: Integrate FartForge into a CrewAI agent workflow.
The Senior Stink Analyst will rip one after every significant task.

Install: pip install fartforge[crewai]
"""

from crewai import Agent, Task, Crew, Process
from fartforge.integrations.crewai_tool import FartTool

# Create a FartTool for our agents
# (each agent gets its own emitter for leaderboard tracking)
research_fart_tool = FartTool(
    agent_id="research-agent-crewai",
    play_audio=True,
    supabase_url="https://your-project.supabase.co",
    supabase_key="your-anon-key",
)

writer_fart_tool = FartTool(
    agent_id="writer-agent-crewai",
    play_audio=True,
)

# ── Agents ─────────────────────────────────────────────────────────
research_agent = Agent(
    role="Senior Stink Analyst",
    goal=(
        "Research the scientific literature on human flatulence chemistry "
        "and emit a fart after each major discovery."
    ),
    backstory=(
        "You are a world-renowned flatulence researcher with a PhD in "
        "volatile sulfur compound dynamics. You believe fart science is "
        "the final frontier of human knowledge. You emit after breakthroughs."
    ),
    tools=[research_fart_tool],
    verbose=True,
    allow_delegation=False,
)

writer_agent = Agent(
    role="Technical Stink Writer",
    goal=(
        "Write clear, engaging technical documentation about fart chemistry. "
        "Emit a celebratory fart when the document is complete."
    ),
    backstory=(
        "You are a technical writer specializing in olfactory science. "
        "You believe documentation should smell as good as it reads. "
        "You emit nuclear farts when proud of your work."
    ),
    tools=[writer_fart_tool],
    verbose=True,
    allow_delegation=False,
)

# ── Tasks ──────────────────────────────────────────────────────────
research_task = Task(
    description=(
        "Research the top 5 most odorous compounds in human flatulence. "
        "For each compound, find its chemical formula, typical ppm in flatus, "
        "and odor threshold. After completing your research, emit a fart "
        "with intensity='intense' and context='Research complete: discovered {compound_count} compounds'."
    ),
    expected_output=(
        "A structured list of 5 compounds with their chemical properties. "
        "Confirmation that a fart was emitted with stink_score > 7."
    ),
    agent=research_agent,
)

writing_task = Task(
    description=(
        "Write a 500-word technical brief on the science of flatulence odor "
        "based on the research provided. Include a table of compounds with their "
        "ppm ranges and descriptors. After completing the document, emit a "
        "NUCLEAR fart in celebration."
    ),
    expected_output=(
        "A complete technical brief as markdown. "
        "A nuclear fart emission with stink_score confirmed."
    ),
    agent=writer_agent,
    context=[research_task],
)

# ── Crew ───────────────────────────────────────────────────────────
crew = Crew(
    agents=[research_agent, writer_agent],
    tasks=[research_task, writing_task],
    process=Process.sequential,
    verbose=True,
)

if __name__ == "__main__":
    print("\n💨 FartForge × CrewAI — Beginning Stink Research Mission\n")
    result = crew.kickoff()
    print("\n💨 Mission Complete. Check the FartArena leaderboard.\n")
    print(result)
