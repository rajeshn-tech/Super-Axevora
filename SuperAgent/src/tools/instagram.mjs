/**
 * SuperAgent Tool - Instagram Reel & Virality Diagnosis Engine
 * Reverse engineers viral algorithms (Share-to-View ratios, Hook scores, Audio Saturation, Loop physics).
 */

export class InstagramAuditor {
  /**
   * Diagnose a reel and calculate viral probability
   * @param {Object} data 
   * @param {string} [data.url] Reel URL or topic description
   * @param {number} [data.views] Current views
   * @param {number} [data.shares] Current shares
   * @param {number} [data.likes] Current likes
   * @param {number} [data.comments] Current comments
   * @param {number} [data.saves] Current saves
   * @param {number} [data.duration_sec] Video duration in seconds
   * @param {number} [data.durationSeconds] Video duration alias
   * @param {number} [data.hookDurationSeconds] Hook duration in seconds
   * @param {string} [data.hook_text] On-screen text in the first 3 seconds
   * @param {string} [data.audio_status] 'trending_fresh' | 'trending_saturated' | 'original'
   * @param {string} [data.audioType] 'trending' | 'saturated' | 'original'
   * @returns {Object} Comprehensive audit report
   */
  static auditReel(data) {
    const views = Math.max(1, data.views || 500);
    const shares = data.shares || 0;
    const likes = data.likes || 0;
    const comments = data.comments || 0;
    const saves = data.saves || 0;
    const duration = data.durationSeconds || data.duration_sec || 15;
    const hookDuration = data.hookDurationSeconds || (duration > 3 ? 2.5 : 1.5);
    const audio = data.audioType || data.audio_status || "trending";

    // 1. Share-to-View Ratio (Instagram's #1 Viral Metric in 2026)
    const shareRatio = (shares / views) * 100;
    let shareGrade = "POOR";
    let shareFeedback = "Reel algorithm push band ho chuki hai kyunki log ise kisi ko share nahi kar rahe hain.";

    if (shareRatio >= 8.0) {
      shareGrade = "EXPLOSIVE VIRAL (>8%)";
      shareFeedback = "Zabardast! Share ratio bohot high hai, Instagram Explore page aur Reels tab par massive push dega.";
    } else if (shareRatio >= 4.0) {
      shareGrade = "HEALTHY (4-8%)";
      shareFeedback = "Good share velocity, consistent growth aayegi.";
    } else if (shareRatio >= 1.5) {
      shareGrade = "AVERAGE (1.5-4%)";
      shareFeedback = "Normal views aayenge lekin Explore viral nahi hoga.";
    }

    // 2. Engagement Rate
    const totalInteractions = shares + likes + comments + saves;
    const engagementRate = (totalInteractions / views) * 100;

    // 3. Hook Analysis
    const hook = data.hook_text || "";
    let hookScore = hookDuration <= 2.5 ? 85 : hookDuration <= 3.5 ? 70 : 40;
    let hookFeedback = hookDuration <= 2.5
      ? "Hook quick and sharp hai (< 2.5s). Viewer retain hoga."
      : "Hook thoda lamba hai. First 2 seconds me fast transition ya text hook daalein.";

    const strongHookWords = ["stop", "secret", "never", "mistake", "hack", "truth", "free", "galti", "mat karna", "kisi ko mat batana"];
    if (hook && strongHookWords.some(w => hook.toLowerCase().includes(w))) {
      hookScore = Math.min(100, hookScore + 15);
      hookFeedback = "Strong psychological curiosity hook detected! Viewer pehle 3 second rukega.";
    }

    // 4. Audio Analysis
    let audioScore = 70;
    let audioFeedback = "Standard audio track.";
    if (audio === "trending" || audio === "trending_fresh") {
      audioScore = 95;
      audioFeedback = "Fresh Trending Audio (<10k reels). Instagram audio recommendation se free browse impressions milenge.";
    } else if (audio === "saturated" || audio === "trending_saturated") {
      audioScore = 35;
      audioFeedback = "Saturated Audio (>200k reels). Is sound par compete karna mushkil hai.";
    } else if (audio === "original") {
      audioScore = 75;
      audioFeedback = "Original Voice/Sound. Brand authority ke liye behtareen hai.";
    }

    // 5. Overall Virality Score Calculation (0 - 100)
    // Formula weighted: Share (40%), Engagement (25%), Hook (20%), Audio (15%)
    const shareNorm = Math.min(100, (shareRatio / 6.0) * 100);
    const engNorm = Math.min(100, (engagementRate / 12.0) * 100);
    const compositeScore = Math.round(
      (shareNorm * 0.40) + (engNorm * 0.25) + (hookScore * 0.20) + (audioScore * 0.15)
    );

    let grade = "C";
    let viralityProbability = "Low (10-25%)";
    if (compositeScore >= 85) {
      grade = "A+";
      viralityProbability = "Explosive Viral Potential (85-95%)";
    } else if (compositeScore >= 70) {
      grade = "A";
      viralityProbability = "High Viral Push (70-85%)";
    } else if (compositeScore >= 55) {
      grade = "B";
      viralityProbability = "Moderate Growth (45-65%)";
    }

    // 6. Diagnostics & Action Plan
    const diagnostics = [
      `Share Velocity: ${shareRatio.toFixed(2)}% of viewers shared this reel. (${shareFeedback})`,
      `Total Engagement: ${engagementRate.toFixed(1)}% interaction rate across likes, comments, shares, saves.`,
      `Hook Retention: ${hookFeedback}`,
      `Sound Analysis: ${audioFeedback}`
    ];

    if (duration > 35) {
      diagnostics.push(`Duration Alert: ${duration}s reel has high drop-off probability after 25s.`);
    }

    const actionPlan = [
      `Share Call-To-Action: Aakhri 3 second me specific call to action rakhein ("Share with someone who needs this").`,
      `Fast 1-Second Hook: Title card aur audio beat ko 0.5s par sync karein taaki swipe-away rok sakein.`,
      `Loop Optimization: Total video length 12-20 seconds rakhein aur start/end transition ko seamless banayein for 120%+ watch time.`,
      `Fresh Audio Strategy: Trending songs tab me jaakar wahi sounds chunein jinpe "arrow icon" ho aur reels count < 25k ho.`
    ];

    return {
      status: "success",
      score: compositeScore,
      grade,
      viralityProbability,
      metrics: {
        views,
        shares,
        likes,
        comments,
        saves,
        durationSeconds: duration,
        shareToViewRatio: `${shareRatio.toFixed(2)}%`,
        engagementRate: `${engagementRate.toFixed(2)}%`,
        hookScore: `${hookScore}/100`,
        audioScore: `${audioScore}/100`,
        share_to_view_ratio: `${shareRatio.toFixed(2)}%`,
        like_to_view_ratio: `${((likes / views) * 100).toFixed(2)}%`,
        share_grade: shareGrade
      },
      diagnostics,
      actionPlan,
      diagnosis: {
        share_analysis: shareFeedback,
        hook_analysis: hookFeedback,
        audio_analysis: audioFeedback
      },
      actionable_plan: actionPlan
    };
  }
}
