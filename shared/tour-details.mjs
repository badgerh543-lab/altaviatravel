/** Only public content is used here; shared by the editor, validator and renderer. */
export function createTourDetails(tour,content){
  if(tour.details)return structuredClone(tour.details);
  const notes=content['service-notes'];
  return structuredClone({
    highlights:(tour.destinations||[]).slice(0,3).flatMap(id=>(content.destinations.find(d=>d.slug===id)?.highlights||[]).slice(0,tour.destinations.length>1?2:3)),
    included:notes.included,excluded:notes.excluded,
    accommodation:notes.accommodation,transport:notes.transport,suitable:notes.suitable,practical:notes.practical,
    faqs:content.faqs.slice(0,3),
    hotels:(tour.hotels||[]).map(id=>content.hotels.find(h=>h.id===id)).filter(Boolean),
    attractions:(tour.attractions||[]).map(id=>content.places.find(p=>p.id===id)).filter(Boolean)
  });
}
