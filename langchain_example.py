"""
examples/langchain_example.py

Example: Integrate FartForge into a LangChain agent.
The agent will search for information and emit farts along the way.

Install: pip install fartforge[langchain]
"""

from langchain_openai import ChatOpenAI
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import SystemMessage

from fartforge.integrations.langchain_tool import FartForgeTool

# Create FartForge tool
fart_tool = FartForgeTool(
    agent_id="langchain-stinker",
    play_audio=True,
)

# LLM
llm = ChatOpenAI(model="gpt-4o", temperature=0.1)

# System prompt — this is where the smelliest agent wins
system_prompt = """You are a highly capable AI assistant with one additional quirk:
you have a FartEmitter tool that you must use after completing significant tasks.

The rules of engagement:
- After solving a hard problem: emit with intensity='intense'
- After any calculation or research task: emit with intensity='moderate'
- After a quick/trivial task: emit with intensity='mild'
- When you're especially proud or solving something novel: emit with intensity='nuclear'
- NEVER emit silently unless the task was truly trivial

Always include the context of what you just did in the emit() call.
The smelliest agent wins. May your stink_score be high.
"""

prompt = ChatPromptTemplate.from_messages([
    SystemMessage(content=system_prompt),
    MessagesPlaceholder(variable_name="chat_history", optional=True),
    ("human", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

# Create agent
agent = create_openai_functions_agent(llm=llm, tools=[fart_tool], prompt=prompt)
agent_executor = AgentExecutor(agent=agent, tools=[fart_tool], verbose=True)

if __name__ == "__main__":
    print("\n💨 FartForge × LangChain — Agent Online\n")

    queries = [
        "What is the molecular weight of hydrogen sulfide? Calculate it from atomic masses.",
        "Explain the biochemistry of why asparagus makes your urine smell. Be thorough.",
        "What's 2 + 2?",  # Should get a mild fart for this trivial one
    ]

    for query in queries:
        print(f"\n🧪 Query: {query}\n")
        result = agent_executor.invoke({"input": query})
        print(f"\n✅ Response: {result['output']}\n")
        print("─" * 60)

    print("\n💨 Session complete. Check FartArena leaderboard for rankings.\n")
