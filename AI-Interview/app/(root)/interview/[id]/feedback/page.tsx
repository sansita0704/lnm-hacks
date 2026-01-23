import dayjs from "dayjs";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import {
    getFeedbackByInterviewId,
    getInterviewById,
} from "@/lib/actions/general.action";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/actions/auth.action";

const Feedback = async ({ params }: RouteParams) => {
    const { id } = await params;

    const user = await getCurrentUser();
    if (!user?.id) redirect("/");

    // Try to get interview, but don't fail if it doesn't exist
    const interview = await getInterviewById(id);

    const feedback = await getFeedbackByInterviewId({
        interviewId: id,
        userId: user.id,
    });

    if (!feedback) {
        return (
            <section className="section-feedback">
                <div className="flex flex-col items-center gap-4 p-8">
                    <h2 className="text-2xl font-semibold">
                        Feedback Not Available
                    </h2>
                    <p>The feedback is still being generated.</p>
                    <Button className="btn-primary">
                        <a href="/" className="flex w-full justify-center">
                            <p className="text-sm font-semibold text-primary-200 text-center">
                                Back to dashboard
                            </p>
                        </a>
                    </Button>
                </div>
            </section>
        );
    }

    return (
        <section className="section-feedback">
            <div className="flex flex-row justify-center">
                <h1 className="text-4xl font-semibold">
                    Feedback on the Interview
                    {interview?.role && (
                        <>
                            {" - "}
                            <span className="capitalize">
                                {interview.role}
                            </span>{" "}
                            Interview
                        </>
                    )}
                </h1>
            </div>

            <div className="flex flex-row justify-center ">
                <div className="flex flex-row gap-5">
                    {/* Overall Impression */}
                    <div className="flex flex-row gap-2 items-center">
                        <Image
                            src="/star.svg"
                            width={22}
                            height={22}
                            alt="star"
                        />
                        <p>
                            Overall Impression:{" "}
                            <span className="text-primary-200 font-bold">
                                {feedback?.totalScore}
                            </span>
                            /100
                        </p>
                    </div>

                    {/* Date */}
                    <div className="flex flex-row gap-2">
                        <Image
                            src="/calendar.svg"
                            width={22}
                            height={22}
                            alt="calendar"
                        />
                        <p>
                            {feedback?.createdAt ?
                                dayjs(feedback.createdAt).format(
                                    "MMM D, YYYY h:mm A",
                                )
                            :   "N/A"}
                        </p>
                    </div>
                </div>
            </div>

            <hr />

            <p>{feedback?.finalAssessment}</p>

            {/* Interview Breakdown */}
            <div className="flex flex-col gap-4">
                <h2>Breakdown of the Interview:</h2>
                {(
                    feedback?.categoryScores &&
                    feedback.categoryScores.length > 0
                ) ?
                    feedback.categoryScores.map((category, index) => (
                        <div key={index}>
                            <p className="font-bold">
                                {index + 1}. {category.name} ({category.score}
                                /100)
                            </p>
                            <p>{category.comment}</p>
                        </div>
                    ))
                :   <p>No category scores available.</p>}
            </div>

            <div className="flex flex-col gap-3">
                <h3>Strengths</h3>
                {
                    (
                        Array.isArray(feedback?.strengths) &&
                        feedback.strengths.length > 0
                    ) ?
                        <ul>
                            {feedback.strengths.map((strength, index) => (
                                <li key={index}>{strength}</li>
                            ))}
                        </ul>
                        // Fallback if it's a string (old data) or empty
                    :   <p>
                            {typeof feedback?.strengths === "string" ?
                                feedback.strengths
                            :   "No strengths listed."}
                        </p>

                }
            </div>

            <div className="flex flex-col gap-3">
                <h3>Areas for Improvement</h3>
                {(
                    feedback?.areasForImprovement &&
                    feedback.areasForImprovement.length > 0
                ) ?
                    <ul>
                        {feedback.areasForImprovement.map((area, index) => (
                            <li key={index}>{area}</li>
                        ))}
                    </ul>
                :   <p>No areas for improvement listed.</p>}
            </div>

            <div className="buttons">
                <Button className="btn-secondary flex-1">
                    <Link href="/" className="flex w-full justify-center">
                        <p className="text-sm font-semibold text-primary-200 text-center">
                            Back to dashboard
                        </p>
                    </Link>
                </Button>

                <Button className="btn-primary flex-1">
                    <Link
                        href={`/interview/${id}`}
                        className="flex w-full justify-center"
                    >
                        <p className="text-sm font-semibold text-black text-center">
                            Retake Interview
                        </p>
                    </Link>
                </Button>
            </div>
        </section>
    );
};

export default Feedback;
