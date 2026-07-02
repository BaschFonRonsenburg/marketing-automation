"""AI Automation — live sales demo (Streamlit).

Thin orchestrator only: all scraping/LLM/data logic lives in tools/.
Run with: streamlit run app.py
"""

import os

import streamlit as st
from dotenv import load_dotenv

load_dotenv()

from tools.scrape_business_site import scrape_business_site
from tools.generate_outreach import generate_outreach_email, generate_social_post
from tools.load_case_studies import load_case_studies

st.set_page_config(page_title="AI Automation — Live Demo", layout="wide")

with st.sidebar:
    st.header("Your Info")
    sender_name = st.text_input("Your name", value=os.environ.get("SENDER_NAME", ""))
    sender_service = st.text_input(
        "Your service tagline",
        value=os.environ.get("SENDER_SERVICE", "AI automation for marketing"),
    )
    if not os.environ.get("ANTHROPIC_API_KEY"):
        st.error("ANTHROPIC_API_KEY not set — add it to .env and restart.")

st.title("AI-Powered Personalized Outreach — Live Demo")

tab_generate, tab_cases = st.tabs(["🎯 Generate Outreach", "📊 Case Studies"])


def _run_generation(business_label: str, research_context: str):
    with st.spinner("Drafting personalized outreach..."):
        email_res = generate_outreach_email(
            business_label, research_context, sender_name, sender_service
        )
        social_res = generate_social_post(business_label, research_context)

    st.session_state["research_context"] = research_context
    st.session_state["email_draft"] = email_res.text if email_res.success else ""
    st.session_state["social_draft"] = social_res.text if social_res.success else ""
    if not email_res.success:
        st.error(email_res.error)
    if not social_res.success:
        st.error(social_res.error)


with tab_generate:
    business_input = st.text_input("Prospect's business name or website URL")

    if st.button("Research & Generate", type="primary", disabled=not business_input):
        st.session_state["manual_fallback"] = False
        with st.spinner("Reading the business's website..."):
            scrape_result = scrape_business_site(business_input)

        if not scrape_result.success:
            st.warning(scrape_result.error)
            st.session_state["manual_fallback"] = True
        else:
            if scrape_result.error_type == "thin_content":
                st.info(scrape_result.error)  # non-fatal warning
            _run_generation(business_input, scrape_result.text)

    if st.session_state.get("manual_fallback"):
        manual_text = st.text_area("Paste a short description of the business instead:")
        if st.button("Generate from manual description", disabled=not manual_text):
            _run_generation(business_input, manual_text)

    if st.session_state.get("research_context"):
        with st.expander("Research context used"):
            st.text(st.session_state["research_context"])

    if st.session_state.get("email_draft"):
        st.subheader("📧 Cold Outreach Email (draft — review before sending)")
        st.text_area(
            "Email draft", value=st.session_state["email_draft"], height=250, key="email_edit"
        )

    if st.session_state.get("social_draft"):
        st.subheader("📱 Social Media Post (draft)")
        st.text_area(
            "Social post draft", value=st.session_state["social_draft"], height=150, key="social_edit"
        )

with tab_cases:
    case_studies = load_case_studies()
    if not case_studies:
        st.info("No case studies yet. Add your own by editing data/case_studies.yaml.")
    else:
        num_cols = min(len(case_studies), 3)
        cols = st.columns(num_cols)
        for i, cs in enumerate(case_studies):
            with cols[i % num_cols]:
                with st.container(border=True):
                    st.subheader(cs.client_name)
                    if cs.client_type:
                        st.caption(cs.client_type)
                    if cs.challenge:
                        st.markdown(f"**Challenge:** {cs.challenge}")
                    if cs.solution:
                        st.markdown(f"**Solution:** {cs.solution}")
                    for r in cs.results:
                        st.metric(r.get("metric", ""), r.get("value", ""))
                    if cs.testimonial:
                        st.markdown(f"> {cs.testimonial}\n\n— {cs.testimonial_author}")
