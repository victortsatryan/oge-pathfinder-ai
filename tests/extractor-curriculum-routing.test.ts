import { describe, expect, it } from "vitest";
import { withUnstartedSourceTopics } from "../src/lib/extractor/curriculum-routing";
const p1 = "4ce570eb-44ee-44f0-9a14-a3faacbfcaa8";
const p2 = "06a8dadf-b6b0-43a3-9b46-a1dcb1ed0951";
describe("future learning route uses verified source topics", () => {
  it("preserves existing assessment state while adding unstarted curriculum themes", () => {
    const current = [{ topic_id:p1, subject_id:"ru", status:"weak", mastery_score:15, mistakes_count:4, topics:{title:"ЕГЭ 9"} }];
    const result=withUnstartedSourceTopics(current,[{topic_id:p2,subject_id:"ru",title:"Орфоэпия"}]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(current[0]);
    expect(result[1]).toMatchObject({topic_id:p2,status:"not_started",mastery_score:0,topics:{title:"Орфоэпия"}});
    expect(current).toHaveLength(1);
  });
  it("never adds duplicate topics already in progress or repeated in source material", () => {
    const result=withUnstartedSourceTopics([{topic_id:p1,subject_id:"ru"}],[
      {topic_id:p1,subject_id:"ru",title:"Существительное"},
      {topic_id:p2,subject_id:"ru",title:"Орфоэпия"},
      {topic_id:p2,subject_id:"ru",title:"Орфоэпия"},
      {topic_id:"",subject_id:"ru",title:""},
    ]);
    expect(result.map(x=>x.topic_id)).toEqual([p1,p2]);
  });
});
