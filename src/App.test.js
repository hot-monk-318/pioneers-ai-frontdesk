import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("react-markdown", () => ({ children }) => <>{children}</>);
jest.mock("remark-gfm", () => () => null);

test("renders parent chat heading", () => {
  render(<App />);
  expect(screen.getByText(/parent chat/i)).toBeInTheDocument();
});
