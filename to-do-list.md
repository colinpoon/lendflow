
 ▐▛███▜▌   Claude Code v2.1.17
▝▜█████▛▘  Opus 4.5 · Claude Pro
  ▘▘ ▝▝    ~/Dev/lendflow

### TO DO LIST

- cost per ai processing is getting too expensive. suggested changes? 
Split the PDF: Don't send the whole document at once. Extract text from the PDF locally first, and send it in smaller, manageable chunks.
Use Embeddings/Search: Instead of passing the whole PDF as input to a prompt, use OpenAI’s File Search (formerly Assistants API) to search through documents. It is often more cost-effective for finding specific information.
Leverage Caching: If querying the same document multiple times, use input caching to reduce costs by 50% or more. 
=================================
- remove/ hide the next.js logo from all pages. 
- add an estimated time to complete an analysis while a a pdf is processing and add percentage completed to the progress bar. ❎
=================================
custom adjustments not appearing on risk tab>ratio breakdown>fccr breakdown
=================================
FCCR 0.44
Seniordebt/ebitda 24,365/7541 = 3.2
totaldebt/total cap 27,614/39,729 = 69.5%
adjusted ebitda 7541
=================================
- intergrate supabase
- login implementation
- need to implement supabase DB
=================================
change risk meter
1 low risk > 10 high risk
implement a 10 step scale.
adjust weights
fccr 45%
sr/eb 40%
totaldebt/totalcap 15%
=================================
reintroduce DCSR card
=================================



