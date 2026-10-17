import {expect,it} from "vitest";
import {sceneDirections} from "@/original/lib/sceneDirections";
it("does not confuse emergency shelter wayfinding safety with hotel lodging",()=>{
 const state={location:"Socorro freeport public transit desk",inventory:[]};
 const action="I request Work Order 7-Beta-9 to correct the unsafe Shelter Beta route near Hangar 7-B.";
 const result="The clerk queued a repair and a public warning, but the repair has not yet occurred.";
 const suggestions=sceneDirections({state,character:{},scene:"Public transit control desk",action,result});
 expect(suggestions).toHaveLength(4);
 expect(suggestions.join(" ")).toMatch(/repair|warning|route/i);
 expect(suggestions.join(" ")).not.toMatch(/rent|monthly rate|deposit|lodging offer|hotel/i);
});
it("continues to support actual accommodation enquiries",()=>{
 const suggestions=sceneDirections({state:{location:"guesthouse"},scene:"Innkeeper at the guesthouse desk",action:"I ask about lodging prices",result:"The innkeeper is ready to discuss available rooms"});
 expect(suggestions.join(" ")).toMatch(/rate|deposit/i);
});
