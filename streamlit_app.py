"""
Streamlit Cloud Deployment Entrypoint
Project: Smart Temperature Analyzer & Converter with Intelligent Alerts
Repository: https://github.com/navinijoylin2008-ops/Temperature_converter
"""

from pathlib import Path
import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="Smart Temperature Analyzer & Converter with Intelligent Alerts",
    page_icon="🌡️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Remove Streamlit default padding/margins and make the embedded app fill the viewport
st.markdown(
    """
    <style>
        #MainMenu, header, footer, [data-testid="stToolbar"], [data-testid="stDecoration"], [data-testid="stStatusWidget"] {
            display: none !important;
            visibility: hidden !important;
        }
        .stApp, [data-testid="stAppViewContainer"], [data-testid="stMain"] {
            padding: 0 !important;
            margin: 0 !important;
            background-color: #060d1f !important;
            overflow: hidden !important;
        }
        .block-container, [data-testid="stMainBlockContainer"] {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
        }
        iframe {
            display: block !important;
            width: 100vw !important;
            height: 100vh !important;
            border: none !important;
        }
    </style>
    """,
    unsafe_allow_html=True,
)


def load_bundled_website() -> str:
    base_dir = Path(__file__).resolve().parent
    html_content = (base_dir / "index.html").read_text(encoding="utf-8")
    css_content = (base_dir / "styles.css").read_text(encoding="utf-8")
    js_content = (base_dir / "script.js").read_text(encoding="utf-8")

    # Smooth in-iframe hash navigation helper so anchor links (#converter, #analyzer, etc.)
    # scroll smoothly inside the Streamlit iframe without triggering cross-origin navigation.
    iframe_scroll_helper = """
    document.addEventListener('DOMContentLoaded', function () {
      document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
          var targetId = anchor.getAttribute('href');
          if (targetId && targetId.length > 1) {
            var targetEl = document.querySelector(targetId);
            if (targetEl) {
              e.preventDefault();
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        });
      });
    });
    """

    html_bundled = html_content.replace(
        '<link rel="stylesheet" href="styles.css" />',
        f"<style>\n{css_content}\n</style>",
    ).replace(
        '<script src="script.js"></script>',
        f"<script>\n{js_content}\n{iframe_scroll_helper}\n</script>",
    )
    return html_bundled


components.html(load_bundled_website(), height=960, scrolling=True)
