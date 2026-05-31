import tempfile

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.tools import tool
from google import genai
from google.genai import types

gemini_client = genai.Client()
GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image"

IMAGE_PROMPT_TEMPLATE = """
16:9 landscape hand-drawn whiteboard illustration on off-white paper with faint blueprint grid lines.
COMPOSITION: All elements centered with 15% margin on all sides.

Subject: {approved_text}

VISUAL REQUIREMENTS:
- Each component represented by a DISTINCTIVE ICON (gears, brains, clouds, envelopes, shields, etc.) inside or above its labeled box
- Boxes connected by sketchy arrows with small annotations on the arrows describing the data flow
- Small decorative doodles: stars, lightbulbs, checkmarks, dotted trails, tiny sparkles
- Color-coded watercolor fills: each box a different soft color (blue, green, orange, coral, purple)
- Short Spanish labels in handwritten script inside each box

Style: hand-drawn pen-and-ink sketch with loose cross-hatching and watercolor accents.
Analog, warm, textured feel — like a creative brainstorming whiteboard. No digital vectors. No title.
"""

IMAGE_GEN_CONFIG = types.GenerateContentConfig(
    response_modalities=["IMAGE"],
    image_config=types.ImageConfig(aspect_ratio="16:9"),
)

last_image_path = None


@tool
def generate_image(approved_text: str) -> str:
    """Genera una imagen estilo whiteboard a partir de texto aprobado.
    Usa esta herramienta cuando tengas el texto final revisado y aprobado.

    Args:
        approved_text: La descripción de texto revisada y aprobada para visualizar.
    """
    global last_image_path

    image_prompt = IMAGE_PROMPT_TEMPLATE.format(approved_text=approved_text)

    response = gemini_client.models.generate_content(
        model=GEMINI_IMAGE_MODEL,
        contents=image_prompt,
        config=IMAGE_GEN_CONFIG,
    )

    image_bytes = None
    for part in response.candidates[0].content.parts:
        if part.inline_data and part.inline_data.data:
            image_bytes = part.inline_data.data
            break

    if not image_bytes:
        return "ERROR: No se generó ninguna imagen."

    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp.write(image_bytes)
    tmp.close()
    last_image_path = tmp.name
    return f"Imagen generada correctamente en: {tmp.name}"


@CrewBase
class ImageGeneratorCrew:
    """Crew para generar imágenes whiteboard a partir de un tema."""

    agents_config = "config/agents.yaml"
    tasks_config = "config/tasks.yaml"

    @agent
    def writer(self) -> Agent:
        return Agent(config=self.agents_config["writer"])

    @agent
    def reviewer(self) -> Agent:
        return Agent(config=self.agents_config["reviewer"])

    @agent
    def image_creator(self) -> Agent:
        return Agent(config=self.agents_config["image_creator"], tools=[generate_image])

    @task
    def write_task(self) -> Task:
        return Task(config=self.tasks_config["write_task"])

    @task
    def review_task(self) -> Task:
        return Task(config=self.tasks_config["review_task"])

    @task
    def image_task(self) -> Task:
        return Task(config=self.tasks_config["image_task"])

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=True,
        )
